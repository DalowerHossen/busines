import 'server-only';

import { requestResendJson, requireEmailSecret } from './http';
import type {
  EmailAdapter,
  EmailAdapterOptions,
  EmailProviderResult,
  SendEmailRequest,
} from './types';

export interface ResendApiConfig {
  readonly apiKey: string;
  readonly from: string;
  readonly replyTo?: string;
  readonly baseUrl?: string;
}

interface ResendEmailResponse {
  readonly id?: unknown;
}

function validateAddress(value: string): string {
  const formatted = value.trim();
  if (formatted.length === 0 || /[\r\n]/.test(formatted)) {
    throw new Error('Email addresses must be non-empty and cannot contain header line breaks.');
  }
  const match = formatted.match(/^.*<([^<>]+)>$/);
  const address = (match?.[1] ?? formatted).trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) {
    throw new Error('Email addresses must use a valid mailbox format.');
  }
  return formatted;
}

function validateRequest(request: SendEmailRequest, defaultFrom: string): SendEmailRequest {
  if (request.to.length === 0 || request.to.length > 50) {
    throw new Error('An email must contain between 1 and 50 recipients.');
  }
  if (/\r|\n/.test(request.subject) || request.subject.trim().length === 0) {
    throw new Error('Email subject is required and cannot contain header line breaks.');
  }
  if (request.html.trim().length === 0 || request.text.trim().length === 0) {
    throw new Error('Email HTML and plain-text bodies are required.');
  }
  return {
    ...request,
    to: request.to.map(validateAddress),
    from: validateAddress(request.from ?? defaultFrom),
    replyTo: request.replyTo ? validateAddress(request.replyTo) : undefined,
  };
}

export class ResendApiAdapter implements EmailAdapter {
  readonly provider = 'resend_api' as const;
  private readonly config: ResendApiConfig;
  private readonly options: EmailAdapterOptions;

  constructor(config: ResendApiConfig, options: EmailAdapterOptions = {}) {
    this.config = config;
    this.options = options;
  }

  async sendEmail(request: SendEmailRequest): Promise<EmailProviderResult> {
    const apiKey = requireEmailSecret(this.config.apiKey, 'resend_api');
    const validated = validateRequest(request, this.config.from);
    const defaultReplyTo = this.config.replyTo ? validateAddress(this.config.replyTo) : undefined;
    const response = await requestResendJson<ResendEmailResponse>({
      apiKey,
      url: `${(this.config.baseUrl ?? 'https://api.resend.com').replace(/\/$/, '')}/emails`,
      timeoutMs: this.options.timeoutMs ?? 10_000,
      body: {
        from: validated.from,
        to: validated.to,
        subject: validated.subject,
        html: validated.html,
        text: validated.text,
        reply_to: validated.replyTo ?? defaultReplyTo,
      },
    });
    if (typeof response.id !== 'string' || response.id.length === 0) {
      throw new Error('Resend response did not include an email identifier.');
    }
    return {
      providerMessageId: response.id,
      status: 'sent',
      providerStatus: 'accepted',
      provider: 'resend_api',
    };
  }
}
