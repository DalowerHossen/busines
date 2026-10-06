import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import Decimal from 'decimal.js';
import { EcommerceProviderError, invalidConfiguration, invalidRequest } from './errors';
import type {
  DirectCheckoutKeyRecord,
  DirectCheckoutRequest,
  DirectCheckoutSessionContract,
  SignedCheckoutCallback,
} from './types';

export function hashDirectCheckoutSecret(secret: string): string {
  if (!secret) throw invalidRequest('direct-checkout');
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function verifyDirectCheckoutSecret(secret: string, storedHash: string): boolean {
  if (!secret || !storedHash) return false;
  return constantTimeEqual(hashDirectCheckoutSecret(secret), storedHash);
}

export function authenticateDirectCheckoutSecret(
  secret: string,
  record: DirectCheckoutKeyRecord
): void {
  assertActiveKey(record);
  if (!verifyDirectCheckoutSecret(secret, record.secretKeyHash)) {
    throw invalidRequest('direct-checkout');
  }
}

export function authenticateDirectCheckoutPublishableKey(
  publishableKey: string,
  record: DirectCheckoutKeyRecord,
  requestOrigin: string
): void {
  assertActiveKey(record);
  if (!verifyDirectCheckoutSecret(publishableKey, record.publishableKeyHash)) {
    throw invalidRequest('direct-checkout');
  }
  if (!isAllowedOrigin(requestOrigin, record.allowedOrigins)) {
    throw invalidRequest('direct-checkout');
  }
}

export function validateDirectCheckoutRequest(
  request: DirectCheckoutRequest,
  allowedOrigins: readonly string[]
): DirectCheckoutSessionContract {
  if (!request.publishableKey || !isIdempotencyKey(request.idempotencyKey)) {
    throw invalidRequest('direct-checkout');
  }
  if (!/^[A-Z]{3}$/.test(request.currencyCode)) throw invalidRequest('direct-checkout');
  const amount = validateDecimal(request.amount, false);
  if (!isHttpsUrl(request.successUrl) || !isHttpsUrl(request.cancelUrl)) {
    throw invalidRequest('direct-checkout');
  }
  if (
    !isAllowedOrigin(request.successUrl, allowedOrigins) ||
    !isAllowedOrigin(request.cancelUrl, allowedOrigins)
  ) {
    throw invalidRequest('direct-checkout');
  }
  if (request.lineItems.length === 0 || request.lineItems.length > 250) {
    throw invalidRequest('direct-checkout');
  }
  const lineItems = request.lineItems.map((lineItem) => {
    if (!lineItem.externalProductId || !lineItem.name) throw invalidRequest('direct-checkout');
    return {
      ...lineItem,
      quantity: validateDecimal(lineItem.quantity, false),
      unitAmount: validateDecimal(lineItem.unitAmount, false),
    };
  });
  return {
    companyId: '',
    apiKeyPairId: '',
    idempotencyKey: request.idempotencyKey,
    currencyCode: request.currencyCode,
    amount,
    lineItems,
    successUrl: request.successUrl,
    cancelUrl: request.cancelUrl,
    customerEmail: request.customerEmail ?? null,
  };
}

export function bindDirectCheckoutSession(
  request: DirectCheckoutSessionContract,
  key: Pick<DirectCheckoutKeyRecord, 'companyId' | 'apiKeyPairId'>
): DirectCheckoutSessionContract {
  return { ...request, companyId: key.companyId, apiKeyPairId: key.apiKeyPairId };
}

export function signCheckoutCallback(secret: string, callback: SignedCheckoutCallback): string {
  if (!secret) throw invalidConfiguration('direct-checkout');
  const payload = JSON.stringify(callback);
  const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('base64');
  return `v1=${signature}`;
}

export function verifyCheckoutCallback(
  secret: string,
  rawBody: string,
  signatureHeader: string | undefined
): boolean {
  if (!secret || !signatureHeader || !signatureHeader.startsWith('v1=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return constantTimeEqual(expected, signatureHeader.slice(3));
}

export function checkoutCallbackHeaders(
  secret: string,
  callback: SignedCheckoutCallback
): Readonly<Record<string, string>> {
  const body = JSON.stringify(callback);
  return {
    'Content-Type': 'application/json',
    'X-Checkout-Event-Id': callback.eventId,
    'X-Checkout-Signature': signCheckoutCallback(secret, callback),
    'X-Checkout-Body-Sha256': createHash('sha256').update(body, 'utf8').digest('hex'),
  };
}

function assertActiveKey(record: DirectCheckoutKeyRecord): void {
  if (
    record.status !== 'active' ||
    (record.expiresAt !== null && Date.parse(record.expiresAt) <= Date.now())
  ) {
    throw invalidRequest('direct-checkout');
  }
}

function validateDecimal(value: string, allowFractionalQuantity: boolean): string {
  const pattern = allowFractionalQuantity
    ? /^\d+(?:\.\d{1,4})?$/
    : /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
  if (!pattern.test(value)) throw invalidRequest('direct-checkout');
  try {
    const decimal = new Decimal(value);
    if (!decimal.isFinite() || decimal.isNegative() || decimal.isZero()) {
      throw invalidRequest('direct-checkout');
    }
    return decimal.toFixed();
  } catch (error) {
    if (error instanceof EcommerceProviderError) throw error;
    throw invalidRequest('direct-checkout');
  }
}

function isAllowedOrigin(value: string, allowedOrigins: readonly string[]): boolean {
  try {
    const url = new URL(value);
    return allowedOrigins.some((origin) => {
      try {
        const allowed = new URL(origin);
        return allowed.origin === url.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isIdempotencyKey(value: string): boolean {
  return value.length >= 1 && value.length <= 255 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
