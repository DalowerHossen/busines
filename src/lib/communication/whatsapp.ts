import 'server-only';

import { constantTimeEqual, hmacSha256Hex, headerValue } from './crypto';
import {
  asRecord,
  normalizeRecipient,
  requestJson,
  requiredString,
  requireSecret,
  stringValue,
} from './http';
import type {
  InboundCommunicationEvent,
  ProviderWebhookRequest,
  ProviderMessageResult,
  SendTextMessageRequest,
  SendWhatsAppTemplateRequest,
  WhatsAppAdapter,
} from './types';
import type { CommunicationAdapterOptions } from './types';

export interface WhatsAppCloudConfig {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly apiVersion: string;
  readonly baseUrl?: string;
  readonly webhookVerifyToken?: string;
  readonly webhookAppSecret?: string;
}

interface WhatsAppSendResponse {
  readonly messaging_product?: unknown;
  readonly contacts?: unknown;
  readonly messages?: unknown;
}

function messageResult(response: WhatsAppSendResponse): ProviderMessageResult {
  const messages = Array.isArray(response.messages) ? response.messages : [];
  const firstMessage = messages[0] === undefined ? null : asRecord(messages[0]);
  const providerMessageId = requiredString(firstMessage?.id, 'whatsapp');
  return {
    providerMessageId,
    status: 'sent',
    providerStatus: null,
    raw: response as unknown as Readonly<Record<string, unknown>>,
  };
}

function validateApiVersion(apiVersion: string): string {
  const version = apiVersion.trim();
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error('WhatsApp Graph API version must be configured as vMAJOR.MINOR.');
  }
  return version;
}

function validateText(body: string): string {
  const text = body.trim();
  if (text.length === 0 || text.length > 4096) {
    throw new Error('WhatsApp text messages must contain between 1 and 4096 characters.');
  }
  return text;
}

export class WhatsAppCloudAdapter implements WhatsAppAdapter {
  readonly channel = 'whatsapp' as const;
  private readonly config: WhatsAppCloudConfig;
  private readonly options: CommunicationAdapterOptions;

  constructor(config: WhatsAppCloudConfig, options: CommunicationAdapterOptions = {}) {
    this.config = config;
    this.options = options;
  }

  async sendText(request: SendTextMessageRequest): Promise<ProviderMessageResult> {
    const version = validateApiVersion(this.config.apiVersion);
    const phoneNumberId = normalizeRecipient(this.config.phoneNumberId, 'whatsapp');
    const recipient = normalizeRecipient(request.recipient, 'whatsapp');
    const body = validateText(request.body);
    const baseUrl = this.config.baseUrl ?? 'https://graph.facebook.com';

    const response = await requestJson<WhatsAppSendResponse>({
      provider: 'whatsapp',
      url: `${baseUrl.replace(/\/$/, '')}/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
      headers: { Authorization: `Bearer ${requireSecret(this.config.accessToken, 'whatsapp')}` },
      timeoutMs: this.options.timeoutMs,
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { preview_url: false, body },
      },
    });
    return messageResult(response);
  }

  async sendTemplate(request: SendWhatsAppTemplateRequest): Promise<ProviderMessageResult> {
    const version = validateApiVersion(this.config.apiVersion);
    const phoneNumberId = normalizeRecipient(this.config.phoneNumberId, 'whatsapp');
    const recipient = normalizeRecipient(request.recipient, 'whatsapp');
    const templateName = request.templateName.trim();
    const languageCode = request.languageCode.trim();
    if (templateName.length === 0 || languageCode.length === 0) {
      throw new Error('WhatsApp template name and language code are required.');
    }
    const baseUrl = this.config.baseUrl ?? 'https://graph.facebook.com';
    const template: Record<string, unknown> = {
      name: templateName,
      language: { code: languageCode },
    };
    if (request.components && request.components.length > 0) {
      template.components = request.components;
    }

    const response = await requestJson<WhatsAppSendResponse>({
      provider: 'whatsapp',
      url: `${baseUrl.replace(/\/$/, '')}/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
      headers: { Authorization: `Bearer ${requireSecret(this.config.accessToken, 'whatsapp')}` },
      timeoutMs: this.options.timeoutMs,
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template,
      },
    });
    return messageResult(response);
  }
}

export function verifyWhatsAppChallenge(input: {
  readonly mode: string | null;
  readonly token: string | null;
  readonly challenge: string | null;
  readonly expectedToken: string;
}): string | null {
  if (
    input.mode !== 'subscribe' ||
    input.token === null ||
    input.challenge === null ||
    !constantTimeEqual(input.token, input.expectedToken)
  ) {
    return null;
  }
  return input.challenge;
}

export function verifyWhatsAppSignature(
  request: ProviderWebhookRequest,
  appSecret: string
): boolean {
  const signature = headerValue(request.headers, 'x-hub-signature-256');
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }
  return constantTimeEqual(
    signature.slice('sha256='.length),
    hmacSha256Hex(appSecret, request.rawBody)
  );
}

export function parseWhatsAppWebhook(rawBody: string): InboundCommunicationEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('WhatsApp webhook payload is invalid.');
  }
  const root = asRecord(parsed);
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const events: InboundCommunicationEvent[] = [];
  for (const entryValue of entries) {
    const entry = asRecord(entryValue);
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const changeValue of changes) {
      const change = asRecord(changeValue);
      const value = asRecord(change.value);
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const messageValue of messages) {
        const message = asRecord(messageValue);
        const textObject = asRecord(message.text);
        const providerMessageId = stringValue(message.id);
        events.push({
          channel: 'whatsapp',
          providerEventId:
            providerMessageId ?? `${stringValue(entry.id) ?? 'entry'}:${events.length}`,
          eventType: 'message',
          providerMessageId,
          senderAddress: stringValue(message.from),
          recipientAddress: stringValue(
            value.metadata && asRecord(value.metadata).display_phone_number
          ),
          text: stringValue(textObject.body),
          occurredAt: null,
          payload: message,
        });
      }
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const statusValue of statuses) {
        const status = asRecord(statusValue);
        const providerMessageId = stringValue(status.id);
        const statusValueText = stringValue(status.status);
        const eventType =
          statusValueText === 'delivered' ||
          statusValueText === 'read' ||
          statusValueText === 'failed'
            ? statusValueText
            : 'unknown';
        events.push({
          channel: 'whatsapp',
          providerEventId: `${providerMessageId ?? 'status'}:${statusValueText ?? 'unknown'}`,
          eventType,
          providerMessageId,
          senderAddress: null,
          recipientAddress: stringValue(status.recipient_id),
          text: null,
          occurredAt: null,
          payload: status,
        });
      }
    }
  }
  return events;
}
