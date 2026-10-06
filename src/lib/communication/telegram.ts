import 'server-only';

import { constantTimeEqual, headerValue } from './crypto';
import { asRecord, normalizeRecipient, requestJson, requireSecret, stringValue } from './http';
import type {
  CommunicationAdapterOptions,
  InboundCommunicationEvent,
  ProviderMessageResult,
  ProviderWebhookRequest,
  SendTextMessageRequest,
} from './types';

export interface TelegramBotConfig {
  readonly botToken: string;
  readonly baseUrl?: string;
  readonly webhookSecretToken?: string;
}

interface TelegramResponse {
  readonly ok?: unknown;
  readonly result?: unknown;
  readonly description?: unknown;
}

function messageId(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  throw new Error('Telegram response did not include a message identifier.');
}

function validateText(value: string): string {
  const text = value.trim();
  if (text.length === 0 || text.length > 4096) {
    throw new Error('Telegram messages must contain between 1 and 4096 characters.');
  }
  return text;
}

function telegramResult(response: TelegramResponse): ProviderMessageResult {
  if (response.ok !== true) {
    throw new Error('Telegram rejected the message request.');
  }
  const result = asRecord(response.result);
  return {
    providerMessageId: messageId(result.message_id),
    status: 'sent',
    providerStatus: 'ok',
    raw: response as unknown as Readonly<Record<string, unknown>>,
  };
}

export class TelegramBotAdapter {
  readonly channel = 'telegram' as const;
  private readonly config: TelegramBotConfig;
  private readonly options: CommunicationAdapterOptions;

  constructor(config: TelegramBotConfig, options: CommunicationAdapterOptions = {}) {
    this.config = config;
    this.options = options;
  }

  async sendText(request: SendTextMessageRequest): Promise<ProviderMessageResult> {
    const token = requireSecret(this.config.botToken, 'telegram');
    const recipient = normalizeRecipient(request.recipient, 'telegram');
    const baseUrl = this.config.baseUrl ?? 'https://api.telegram.org';
    const response = await requestJson<TelegramResponse>({
      provider: 'telegram',
      url: `${baseUrl.replace(/\/$/, '')}/bot${encodeURIComponent(token)}/sendMessage`,
      headers: {},
      body: { chat_id: recipient, text: validateText(request.body) },
      timeoutMs: this.options.timeoutMs,
    });
    return telegramResult(response);
  }

  async setWebhook(input: {
    readonly url: string;
    readonly allowedUpdates?: readonly string[];
    readonly dropPendingUpdates?: boolean;
  }): Promise<void> {
    const webhookUrl = new URL(input.url);
    if (webhookUrl.protocol !== 'https:') {
      throw new Error('Telegram webhook URLs must use HTTPS.');
    }
    const token = requireSecret(this.config.botToken, 'telegram');
    const baseUrl = this.config.baseUrl ?? 'https://api.telegram.org';
    const body: Record<string, unknown> = { url: input.url };
    if (this.config.webhookSecretToken) body.secret_token = this.config.webhookSecretToken;
    if (input.allowedUpdates) body.allowed_updates = input.allowedUpdates;
    if (input.dropPendingUpdates !== undefined)
      body.drop_pending_updates = input.dropPendingUpdates;
    const response = await requestJson<TelegramResponse>({
      provider: 'telegram',
      url: `${baseUrl.replace(/\/$/, '')}/bot${encodeURIComponent(token)}/setWebhook`,
      headers: {},
      body,
      timeoutMs: this.options.timeoutMs,
    });
    if (response.ok !== true) {
      throw new Error('Telegram rejected the webhook configuration.');
    }
  }
}

export function verifyTelegramWebhook(
  request: ProviderWebhookRequest,
  expectedSecretToken: string
): boolean {
  const received = headerValue(request.headers, 'x-telegram-bot-api-secret-token');
  return received !== undefined && constantTimeEqual(received, expectedSecretToken);
}

export function parseTelegramWebhook(rawBody: string): InboundCommunicationEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Telegram webhook payload is invalid.');
  }
  const root = asRecord(parsed);
  const updateId = root.update_id;
  const message = asRecord(root.message ?? root.edited_message ?? root.channel_post);
  const text = stringValue(message.text);
  if (Object.keys(message).length === 0) {
    return [];
  }
  const chat = asRecord(message.chat);
  const from = asRecord(message.from);
  return [
    {
      channel: 'telegram',
      providerEventId:
        typeof updateId === 'number'
          ? String(updateId)
          : `telegram:${String(message.message_id ?? 'event')}`,
      eventType: 'message',
      providerMessageId: typeof message.message_id === 'number' ? String(message.message_id) : null,
      senderAddress: typeof from.id === 'number' ? String(from.id) : stringValue(from.username),
      recipientAddress: typeof chat.id === 'number' ? String(chat.id) : stringValue(chat.username),
      text,
      occurredAt:
        typeof message.date === 'number' ? new Date(message.date * 1000).toISOString() : null,
      payload: root,
    },
  ];
}
