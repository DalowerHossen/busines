import type { InboundCommunicationEvent, ProviderWebhookRequest } from './types';
import { parseTwilioWebhook, verifyTwilioWebhook } from './twilio-sms';
import { parseViberWebhook, verifyViberWebhook } from './viber';
import { parseWhatsAppWebhook, verifyWhatsAppSignature } from './whatsapp';
import { parseTelegramWebhook, verifyTelegramWebhook } from './telegram';

export function parseFormWebhook(rawBody: string): Readonly<Record<string, string>> {
  const values = new URLSearchParams(rawBody);
  return Object.fromEntries(values.entries());
}

export function verifyWhatsAppRequest(request: ProviderWebhookRequest, appSecret: string): boolean {
  return verifyWhatsAppSignature(request, appSecret);
}

export function verifyTwilioRequest(
  request: ProviderWebhookRequest,
  callbackUrl: string,
  authToken: string
): boolean {
  return verifyTwilioWebhook(request, callbackUrl, parseFormWebhook(request.rawBody), authToken);
}

export function verifyTelegramRequest(
  request: ProviderWebhookRequest,
  secretToken: string
): boolean {
  return verifyTelegramWebhook(request, secretToken);
}

export function verifyViberRequest(request: ProviderWebhookRequest, authToken: string): boolean {
  return verifyViberWebhook(request, authToken);
}

export function parseProviderWebhook(
  channel: 'whatsapp' | 'telegram' | 'viber' | 'sms',
  rawBody: string
): readonly InboundCommunicationEvent[] {
  switch (channel) {
    case 'whatsapp':
      return parseWhatsAppWebhook(rawBody);
    case 'telegram':
      return parseTelegramWebhook(rawBody);
    case 'viber':
      return parseViberWebhook(rawBody);
    case 'sms':
      return [parseTwilioWebhook(parseFormWebhook(rawBody))];
  }
}
