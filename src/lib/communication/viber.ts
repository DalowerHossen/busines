import 'server-only';

import { constantTimeEqual, headerValue, hmacSha256Hex } from './crypto';
import { asRecord, normalizeRecipient, requestJson, requireSecret, stringValue } from './http';
import type {
  CommunicationAdapterOptions,
  InboundCommunicationEvent,
  ProviderMessageResult,
  ProviderWebhookRequest,
  SendTextMessageRequest,
} from './types';

export interface ViberBotConfig {
  readonly authToken: string;
  readonly senderName: string;
  readonly senderAvatar?: string;
  readonly baseUrl?: string;
}

interface ViberResponse {
  readonly status?: unknown;
  readonly status_message?: unknown;
  readonly message_token?: unknown;
}

function validateText(value: string): string {
  const text = value.trim();
  if (text.length === 0) {
    throw new Error('Viber message body is required.');
  }
  return text;
}

function viberResult(response: ViberResponse): ProviderMessageResult {
  if (response.status !== 0) {
    throw new Error('Viber rejected the message request.');
  }
  const providerMessageId = response.message_token;
  if (
    !(
      (typeof providerMessageId === 'string' && providerMessageId.length > 0) ||
      (typeof providerMessageId === 'number' && Number.isSafeInteger(providerMessageId))
    )
  ) {
    throw new Error('Viber response did not include a message identifier.');
  }
  return {
    providerMessageId: String(providerMessageId),
    status: 'sent',
    providerStatus: '0',
    raw: response as unknown as Readonly<Record<string, unknown>>,
  };
}

export class ViberBotAdapter {
  readonly channel = 'viber' as const;
  private readonly config: ViberBotConfig;
  private readonly options: CommunicationAdapterOptions;

  constructor(config: ViberBotConfig, options: CommunicationAdapterOptions = {}) {
    this.config = config;
    this.options = options;
  }

  async sendText(request: SendTextMessageRequest): Promise<ProviderMessageResult> {
    const recipient = normalizeRecipient(request.recipient, 'viber');
    const senderName = this.config.senderName.trim();
    if (senderName.length === 0 || senderName.length > 28) {
      throw new Error('Viber sender name must contain between 1 and 28 characters.');
    }
    const baseUrl = this.config.baseUrl ?? 'https://chatapi.viber.com/pa';
    const sender: Record<string, string> = { name: senderName };
    if (this.config.senderAvatar) sender.avatar = this.config.senderAvatar;
    const response = await requestJson<ViberResponse>({
      provider: 'viber',
      url: `${baseUrl.replace(/\/$/, '')}/send_message`,
      headers: { 'X-Viber-Auth-Token': requireSecret(this.config.authToken, 'viber') },
      body: {
        receiver: recipient,
        type: 'text',
        sender,
        text: validateText(request.body),
      },
      timeoutMs: this.options.timeoutMs,
    });
    return viberResult(response);
  }

  async setWebhook(input: {
    readonly url: string;
    readonly eventTypes?: readonly string[];
  }): Promise<void> {
    const webhookUrl = new URL(input.url);
    if (webhookUrl.protocol !== 'https:') {
      throw new Error('Viber webhook URLs must use HTTPS.');
    }
    const baseUrl = this.config.baseUrl ?? 'https://chatapi.viber.com/pa';
    const body: Record<string, unknown> = { url: input.url };
    if (input.eventTypes) body.event_types = input.eventTypes;
    const response = await requestJson<ViberResponse>({
      provider: 'viber',
      url: `${baseUrl.replace(/\/$/, '')}/set_webhook`,
      headers: { 'X-Viber-Auth-Token': requireSecret(this.config.authToken, 'viber') },
      body,
      timeoutMs: this.options.timeoutMs,
    });
    if (response.status !== 0) {
      throw new Error('Viber rejected the webhook configuration.');
    }
  }
}

export function verifyViberWebhook(request: ProviderWebhookRequest, authToken: string): boolean {
  const signature = headerValue(request.headers, 'x-viber-content-signature');
  return (
    signature !== undefined &&
    constantTimeEqual(signature, hmacSha256Hex(authToken, request.rawBody))
  );
}

export function parseViberWebhook(rawBody: string): InboundCommunicationEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Viber webhook payload is invalid.');
  }
  const root = asRecord(parsed);
  const eventType = stringValue(root.event);
  const message = asRecord(root.message);
  const sender = asRecord(root.sender);
  const text = stringValue(message.text);
  const providerMessageId = stringValue(root.message_token);
  const normalizedEventType =
    eventType === 'delivered' || eventType === 'seen' || eventType === 'failed'
      ? eventType === 'seen'
        ? 'read'
        : eventType
      : eventType === 'message'
        ? 'message'
        : 'unknown';
  return [
    {
      channel: 'viber',
      providerEventId:
        providerMessageId ?? `${eventType ?? 'event'}:${String(root.timestamp ?? 'unknown')}`,
      eventType: normalizedEventType,
      providerMessageId,
      senderAddress: stringValue(sender.id),
      recipientAddress: null,
      text,
      occurredAt:
        typeof root.timestamp === 'number' ? new Date(root.timestamp).toISOString() : null,
      payload: root,
    },
  ];
}
