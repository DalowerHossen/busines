import 'server-only';

import { createHash } from 'node:crypto';
import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';

import { EmailProviderError, requireEmailSecret } from './http';
import type {
  EmailAdapter,
  EmailAdapterOptions,
  EmailProviderResult,
  SendEmailRequest,
} from './types';

export interface SmtpEmailConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly from: string;
  readonly replyTo?: string;
  readonly secure?: boolean;
}

interface SmtpResponse {
  readonly code: number;
  readonly lines: readonly string[];
}

interface PendingLine {
  readonly resolve: (line: string) => void;
  readonly reject: (error: Error) => void;
}

function safeHeader(value: string, field: string): string {
  if (value.length === 0 || /[\r\n]/.test(value)) {
    throw new Error(`${field} is required and cannot contain header line breaks.`);
  }
  return value;
}

function mailbox(value: string, field: string): string {
  const input = safeHeader(value.trim(), field);
  const match = input.match(/^.*<([^<>]+)>$/);
  const address = (match?.[1] ?? input).trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) {
    throw new Error(`${field} must contain a valid mailbox address.`);
  }
  return address;
}

function encodeHeader(value: string): string {
  return /[^\x20-\x7e]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
    : value;
}

function validateEmailRequest(request: SendEmailRequest, defaultFrom: string): SendEmailRequest {
  if (request.to.length === 0 || request.to.length > 50) {
    throw new Error('An email must contain between 1 and 50 recipients.');
  }
  safeHeader(request.subject.trim(), 'Email subject');
  if (request.html.trim().length === 0 || request.text.trim().length === 0) {
    throw new Error('Email HTML and plain-text bodies are required.');
  }
  request.to.forEach((address) => mailbox(address, 'Email recipient'));
  mailbox(request.from ?? defaultFrom, 'Email sender');
  if (request.replyTo) mailbox(request.replyTo, 'Email reply-to');
  return request;
}

function retryableSmtpCode(code: number): boolean {
  return code >= 400 && code < 500;
}

class SmtpConnection {
  private buffer = '';
  private readonly pending: PendingLine[] = [];
  private readonly onData = (chunk: string | Buffer): void => {
    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    this.flushLines();
  };
  private readonly onError = (error: Error): void => {
    while (this.pending.length > 0) {
      this.pending.shift()?.reject(error);
    }
  };
  private readonly onClose = (): void => {
    this.onError(new Error('SMTP connection closed.'));
  };

  constructor(readonly socket: Socket | TLSSocket) {
    this.socket.setEncoding('utf8');
    this.socket.on('data', this.onData);
    this.socket.on('error', this.onError);
    this.socket.on('close', this.onClose);
  }

  detach(): void {
    this.socket.off('data', this.onData);
    this.socket.off('error', this.onError);
    this.socket.off('close', this.onClose);
  }

  close(): void {
    this.detach();
    this.socket.destroy();
  }

  private flushLines(): void {
    while (this.pending.length > 0) {
      const separator = this.buffer.indexOf('\r\n');
      if (separator < 0) return;
      const line = this.buffer.slice(0, separator);
      this.buffer = this.buffer.slice(separator + 2);
      this.pending.shift()?.resolve(line);
    }
  }

  private readLine(): Promise<string> {
    const separator = this.buffer.indexOf('\r\n');
    if (separator >= 0) {
      const line = this.buffer.slice(0, separator);
      this.buffer = this.buffer.slice(separator + 2);
      return Promise.resolve(line);
    }
    return new Promise<string>((resolve, reject) => this.pending.push({ resolve, reject }));
  }

  async readResponse(): Promise<SmtpResponse> {
    const firstLine = await this.readLine();
    const firstMatch = firstLine.match(/^(\d{3})([- ])(.*)$/);
    if (!firstMatch) throw new EmailProviderError('resend_smtp', null, false);
    const code = Number(firstMatch[1]);
    const lines = [firstLine];
    if (firstMatch[2] === '-') {
      while (true) {
        const line = await this.readLine();
        lines.push(line);
        const match = line.match(/^(\d{3})([- ])(.*)$/);
        if (match && Number(match[1]) === code && match[2] === ' ') break;
      }
    }
    return { code, lines };
  }

  async write(value: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const written = this.socket.write(value, 'utf8', (error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
      if (!written) this.socket.once('drain', resolve);
    });
  }

  async command(command: string, expectedCodes: readonly number[]): Promise<SmtpResponse> {
    await this.write(`${command}\r\n`);
    const response = await this.readResponse();
    if (!expectedCodes.includes(response.code)) {
      throw new EmailProviderError('resend_smtp', response.code, retryableSmtpCode(response.code));
    }
    return response;
  }
}

function connectSocket(config: SmtpEmailConfig, timeoutMs: number): Promise<Socket | TLSSocket> {
  const secure = config.secure ?? config.port === 465;
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tlsConnect({ host: config.host, port: config.port, servername: config.host })
      : netConnect({ host: config.host, port: config.port });
    const event = secure ? 'secureConnect' : 'connect';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new EmailProviderError('resend_smtp', null, true));
    }, timeoutMs);
    socket.once(event, () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      reject(new EmailProviderError('resend_smtp', null, true));
    });
  });
}

function upgradeToTls(socket: Socket, host: string, timeoutMs: number): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = tlsConnect({ socket, servername: host, rejectUnauthorized: true });
    const timer = setTimeout(() => {
      secureSocket.destroy();
      reject(new EmailProviderError('resend_smtp', null, true));
    }, timeoutMs);
    secureSocket.once('secureConnect', () => {
      clearTimeout(timer);
      resolve(secureSocket);
    });
    secureSocket.once('error', () => {
      clearTimeout(timer);
      reject(new EmailProviderError('resend_smtp', null, true));
    });
  });
}

function dotStuff(value: string): string {
  return value
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

function mimeMessage(request: SendEmailRequest, config: SmtpEmailConfig): string {
  const from = request.from ?? config.from;
  const replyTo = request.replyTo ?? config.replyTo;
  const messageHash = createHash('sha256')
    .update(`${request.idempotencyKey}:${from}:${request.to.join(',')}`)
    .digest('hex');
  const boundary = `=_alternative_${messageHash.slice(0, 32)}`;
  const headers = [
    `From: ${encodeHeader(from)}`,
    `To: ${request.to.map(encodeHeader).join(', ')}`,
    `Subject: ${encodeHeader(request.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageHash}@local.invalid>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (replyTo) headers.splice(3, 0, `Reply-To: ${encodeHeader(replyTo)}`);
  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    request.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    request.html,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

export class SmtpEmailAdapter implements EmailAdapter {
  readonly provider = 'resend_smtp' as const;
  private readonly config: SmtpEmailConfig;
  private readonly options: EmailAdapterOptions;

  constructor(config: SmtpEmailConfig, options: EmailAdapterOptions = {}) {
    this.config = config;
    this.options = options;
  }

  async sendEmail(request: SendEmailRequest): Promise<EmailProviderResult> {
    const timeoutMs = this.options.timeoutMs ?? 15_000;
    const username = requireEmailSecret(this.config.username, 'resend_smtp');
    const password = requireEmailSecret(this.config.password, 'resend_smtp');
    validateEmailRequest(request, this.config.from);
    if (this.config.replyTo) mailbox(this.config.replyTo, 'SMTP reply-to');
    if (!this.config.host || !Number.isInteger(this.config.port) || this.config.port <= 0) {
      throw new Error('SMTP host and port must be configured.');
    }

    let connection: SmtpConnection | null = null;
    try {
      const socket = await connectSocket(this.config, timeoutMs);
      connection = new SmtpConnection(socket);
      const greeting = await connection.readResponse();
      if (greeting.code !== 220) {
        throw new EmailProviderError(
          'resend_smtp',
          greeting.code,
          retryableSmtpCode(greeting.code)
        );
      }
      await connection.command('EHLO localhost', [250]);
      if (!(this.config.secure ?? this.config.port === 465)) {
        await connection.command('STARTTLS', [220]);
        const oldConnection = connection;
        oldConnection.detach();
        const secureSocket = await upgradeToTls(oldConnection.socket, this.config.host, timeoutMs);
        connection = new SmtpConnection(secureSocket);
        await connection.command('EHLO localhost', [250]);
      }
      await connection.command('AUTH LOGIN', [334]);
      await connection.command(Buffer.from(username, 'utf8').toString('base64'), [334]);
      await connection.command(Buffer.from(password, 'utf8').toString('base64'), [235]);

      const sender = mailbox(request.from ?? this.config.from, 'Email sender');
      await connection.command(`MAIL FROM:<${sender}>`, [250]);
      for (const recipient of request.to) {
        await connection.command(
          `RCPT TO:<${mailbox(recipient, 'Email recipient')}>`,
          [250, 251, 252]
        );
      }
      await connection.command('DATA', [354]);
      await connection.write(`${dotStuff(mimeMessage(request, this.config))}\r\n.\r\n`);
      await connection.readResponse().then((response) => {
        if (response.code !== 250) {
          throw new EmailProviderError(
            'resend_smtp',
            response.code,
            retryableSmtpCode(response.code)
          );
        }
      });
      const providerMessageId = createHash('sha256').update(request.idempotencyKey).digest('hex');
      try {
        await connection.command('QUIT', [221, 250]);
      } catch {
        // The DATA response already acknowledged the message; QUIT is best effort.
      }
      return {
        providerMessageId: `smtp-${providerMessageId}`,
        status: 'sent',
        providerStatus: 'accepted',
        provider: 'resend_smtp',
      };
    } catch (error) {
      if (error instanceof EmailProviderError) throw error;
      throw new EmailProviderError('resend_smtp', null, true);
    } finally {
      connection?.close();
    }
  }
}
