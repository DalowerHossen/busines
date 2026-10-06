import 'server-only';

import { invalidResponse, signatureInvalid } from './errors';
import { asRecord } from './http';
import { headerValue } from './signing';
import { hmacSha256Base64, verifyBase64Hmac } from './signing';
import type { EcommerceWebhookEvent, EcommerceWebhookRequest } from './types';

export function verifyShopifyWebhook(
  request: EcommerceWebhookRequest,
  appClientSecret: string
): boolean {
  return verifyBase64Hmac(
    appClientSecret,
    request.rawBody,
    headerValue(request.headers, 'X-Shopify-Hmac-Sha256')
  );
}

export function verifyWooCommerceWebhook(
  request: EcommerceWebhookRequest,
  webhookSecret: string
): boolean {
  return verifyBase64Hmac(
    webhookSecret,
    request.rawBody,
    headerValue(request.headers, 'X-WC-Webhook-Signature')
  );
}

export function parseVerifiedShopifyWebhook(
  request: EcommerceWebhookRequest,
  appClientSecret: string,
  connectionId: string
): EcommerceWebhookEvent {
  if (!verifyShopifyWebhook(request, appClientSecret)) {
    throw signatureInvalid('shopify');
  }
  const payload = parseObject(request.rawBody, 'shopify');
  const providerEventId = headerValue(request.headers, 'X-Shopify-Webhook-Id');
  const topic = headerValue(request.headers, 'X-Shopify-Topic');
  if (!providerEventId || !topic) throw invalidResponse('shopify');
  return {
    platform: 'shopify',
    connectionId,
    providerEventId,
    topic,
    payload,
  };
}

export function parseVerifiedWooCommerceWebhook(
  request: EcommerceWebhookRequest,
  webhookSecret: string,
  connectionId: string
): EcommerceWebhookEvent {
  if (!verifyWooCommerceWebhook(request, webhookSecret)) {
    throw signatureInvalid('woocommerce');
  }
  const payload = parseObject(request.rawBody, 'woocommerce');
  const providerEventId = headerValue(request.headers, 'X-WC-Webhook-Delivery-Id');
  const topic = headerValue(request.headers, 'X-WC-Webhook-Topic');
  if (!providerEventId || !topic) throw invalidResponse('woocommerce');
  return {
    platform: 'woocommerce',
    connectionId,
    providerEventId,
    topic,
    payload,
  };
}

function parseObject(
  rawBody: string,
  provider: 'shopify' | 'woocommerce'
): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return asRecord(parsed);
  } catch {
    throw invalidResponse(provider);
  }
}

export interface EcommerceWebhookEventClaimStore {
  claim(event: EcommerceWebhookEvent): Promise<boolean>;
}

export async function claimEcommerceWebhookEvent(
  store: EcommerceWebhookEventClaimStore,
  event: EcommerceWebhookEvent
): Promise<{ readonly accepted: boolean; readonly duplicate: boolean }> {
  const accepted = await store.claim(event);
  return { accepted, duplicate: !accepted };
}

export function webhookSignatureForTest(secret: string, rawBody: string): string {
  return hmacSha256Base64(secret, rawBody);
}
