import 'server-only';

import { createHmac } from 'node:crypto';

import { constantTimeEqual, headerValue } from './crypto';
import {
  asRecord,
  normalizeRecipient,
  requestForm,
  requiredString,
  requireSecret,
  stringValue,
} from './http';
import type {
  CommunicationAdapterOptions,
  InboundCommunicationEvent,
  ProviderMessageResult,
  ProviderWebhookRequest,
  SendTextMessageRequest,
} from './types';

export interface TwilioMessagingConfig {
  readonly accountSid: string;
  readonly authToken: string;
  readonly from?: string;
  readonly messagingServiceSid?: string;
  readonly baseUrl?: string;
  readonly webhookAuthToken?: string;
}

interface TwilioMessageResponse {
  readonly sid?: unknown;
  readonly status?: unknown;
  readonly error_code?: unknown;
}

function e164(value: string): string {
  const normalized = value.trim();
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    throw new Error('SMS recipients must use an E.164 phone number.');
  }
  return normalized;
}

function messageResult(response: TwilioMessageResponse): ProviderMessageResult {
  return {
    providerMessageId: requiredString(response.sid, 'twilio'),
    status: 'sent',
    providerStatus: stringValue(response.status),
    raw: response as unknown as Readonly<Record<string, unknown>>,
  };
}

export class TwilioSmsAdapter {
  readonly channel = 'sms' as const;
  private readonly config: TwilioMessagingConfig;
  private readonly options: CommunicationAdapterOptions;

  constructor(config: TwilioMessagingConfig, options: CommunicationAdapterOptions = {}) {
    this.config = config;
    this.options = options;
  }

  async sendText(request: SendTextMessageRequest): Promise<ProviderMessageResult> {
    const configuredAccountSid = requireSecret(this.config.accountSid, 'twilio');
    const configuredAuthToken = requireSecret(this.config.authToken, 'twilio');
    const accountSid = normalizeRecipient(configuredAccountSid, 'twilio');
    const recipient = e164(normalizeRecipient(request.recipient, 'twilio'));
    const from = this.config.from ? normalizeRecipient(this.config.from, 'twilio') : null;
    const messagingServiceSid = this.config.messagingServiceSid?.trim() || null;
    if (!from && !messagingServiceSid) {
      throw new Error('Twilio requires a configured sender or Messaging Service SID.');
    }
    const body = request.body.trim();
    if (body.length === 0) {
      throw new Error('SMS message body is required.');
    }
    const form = new URLSearchParams({ Body: body, To: recipient });
    if (from) form.set('From', from);
    if (messagingServiceSid) form.set('MessagingServiceSid', messagingServiceSid);
    if (request.statusCallbackUrl) form.set('StatusCallback', request.statusCallbackUrl);

    const baseUrl = this.config.baseUrl ?? 'https://api.twilio.com';
    const authorization = Buffer.from(`${configuredAccountSid}:${configuredAuthToken}`).toString(
      'base64'
    );
    const response = await requestForm<TwilioMessageResponse>({
      provider: 'twilio',
      url: `${baseUrl.replace(/\/$/, '')}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      headers: { Authorization: `Basic ${authorization}` },
      body: form,
      timeoutMs: this.options.timeoutMs,
    });
    return messageResult(response);
  }
}

function twilioSignaturePayload(url: string, parameters: Readonly<Record<string, string>>): string {
  const sorted = Object.keys(parameters)
    .sort()
    .map((key) => `${key}${parameters[key] ?? ''}`)
    .join('');
  return `${url}${sorted}`;
}

export function verifyTwilioWebhook(
  request: ProviderWebhookRequest,
  callbackUrl: string,
  parameters: Readonly<Record<string, string>>,
  authToken: string
): boolean {
  const signature = headerValue(request.headers, 'x-twilio-signature');
  if (!signature) {
    return false;
  }
  const expected = createHmac('sha1', authToken)
    .update(twilioSignaturePayload(callbackUrl, parameters), 'utf8')
    .digest('base64');
  return constantTimeEqual(signature, expected);
}

export function parseTwilioWebhook(
  parameters: Readonly<Record<string, string>>
): InboundCommunicationEvent {
  const providerMessageId = parameters.MessageSid ?? null;
  const raw = asRecord(parameters);
  const status = parameters.MessageStatus;
  const eventType =
    status === 'delivered' || status === 'read' || status === 'failed' ? status : 'message';
  return {
    channel: 'sms',
    providerEventId: providerMessageId ?? `twilio:${parameters.MessageSid ?? 'inbound'}`,
    eventType,
    providerMessageId,
    senderAddress: parameters.From ?? null,
    recipientAddress: parameters.To ?? null,
    text: parameters.Body ?? null,
    occurredAt: null,
    payload: raw,
  };
}
