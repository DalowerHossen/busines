// src/lib/payments/webhooks/verify.ts
// Deciding whether a webhook really came from the provider it claims.
//
// The check always runs against the exact bytes that arrived, because a body
// that has been parsed and printed again no longer matches the signature the
// provider calculated.

import 'server-only';

import { createHmac } from 'node:crypto';

import { hmacBase64WithHexKey, hmacHex, signaturesMatch } from '@/lib/crypto/hashing';
import type { GatewayProvider } from '@/types/enums';

export interface SignatureCheck {
  /** True when the body matches the signature the provider sent. */
  isVerified: boolean;
  /** Why the check failed, for the log and the stored event. */
  reason: string | null;
}

/** How far out of step a provider clock may be before a call is rejected. */
const MAX_SKEW_SECONDS = 300;

/**
 * Reads the parts of a Stripe signature header.
 *
 * @param header Value of the stripe-signature header.
 * @returns The timestamp and the signatures it carries.
 */
function parseStripeHeader(header: string): { timestamp: string | null; signatures: string[] } {
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const [key, value] = part.split('=');

    if (!key || !value) {
      continue;
    }

    if (key.trim() === 't') {
      timestamp = value.trim();
    }

    if (key.trim() === 'v1') {
      signatures.push(value.trim());
    }
  }

  return { timestamp, signatures };
}

/**
 * Escapes one field of an Adyen notification the way Adyen does before it
 * signs, so a colon inside a reference cannot shift the other fields along.
 *
 * @param value Field value, which may be absent.
 * @returns The escaped value.
 */
function escapeAdyenField(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);

  return text.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
}

/**
 * Narrows an unknown payload to an object.
 *
 * @param value Value parsed from a webhook body.
 * @returns True when the value can be read by key.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks an Adyen notification, which carries its signature inside the body
 * rather than in a header, one signature per notification item.
 *
 * @param rawBody Exact bytes of the request body.
 * @param hexKey Notification key, written in hexadecimal.
 * @returns Whether every item in the batch is signed correctly.
 */
function verifyAdyenNotification(rawBody: string, hexKey: string): SignatureCheck {
  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { isVerified: false, reason: 'The notification body could not be read.' };
  }

  const items = isRecord(payload) ? payload['notificationItems'] : null;

  if (!Array.isArray(items) || items.length === 0) {
    return { isVerified: false, reason: 'The notification carried nothing to check.' };
  }

  for (const entry of items) {
    const wrapper = isRecord(entry) ? entry['NotificationRequestItem'] : null;

    if (!isRecord(wrapper)) {
      return { isVerified: false, reason: 'The notification body could not be read.' };
    }

    const additional = isRecord(wrapper['additionalData']) ? wrapper['additionalData'] : {};
    const sent = additional['hmacSignature'];

    if (typeof sent !== 'string' || sent.length === 0) {
      return { isVerified: false, reason: 'The call arrived without a signature.' };
    }

    const amount = isRecord(wrapper['amount']) ? wrapper['amount'] : {};
    const signedFields = [
      wrapper['pspReference'],
      wrapper['originalReference'],
      wrapper['merchantAccountCode'],
      wrapper['merchantReference'],
      amount['value'],
      amount['currency'],
      wrapper['eventCode'],
      wrapper['success'],
    ]
      .map(escapeAdyenField)
      .join(':');

    if (!signaturesMatch(sent, hmacBase64WithHexKey(signedFields, hexKey))) {
      return { isVerified: false, reason: 'The signature does not match the body that arrived.' };
    }
  }

  return { isVerified: true, reason: null };
}

/**
 * Checks the signature on an incoming webhook.
 *
 * @param provider Provider the call claims to come from.
 * @param rawBody Exact bytes of the request body.
 * @param header Signature header sent with the request.
 * @param secret Signing secret stored with the connection.
 * @returns Whether the call can be trusted.
 */
export function verifyWebhookSignature(
  provider: GatewayProvider,
  rawBody: string,
  header: string | null,
  secret: string | null
): SignatureCheck {
  if (!secret) {
    return { isVerified: false, reason: 'No signing secret has been saved for this provider.' };
  }

  if (provider === 'adyen') {
    return verifyAdyenNotification(rawBody, secret);
  }

  if (!header) {
    return { isVerified: false, reason: 'The call arrived without a signature.' };
  }

  if (provider === 'nium') {
    // Nium signs the body with the shared secret and sends the digest either
    // in hexadecimal or in base64, depending on the product the call is from.
    const candidate = header.trim();
    const hex = hmacHex(rawBody, secret);
    const base64 = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    const isVerified = signaturesMatch(candidate, hex) || signaturesMatch(candidate, base64);

    return {
      isVerified,
      reason: isVerified ? null : 'The signature does not match the body that arrived.',
    };
  }

  if (provider === 'stripe') {
    const { timestamp, signatures } = parseStripeHeader(header);

    if (timestamp === null || signatures.length === 0) {
      return { isVerified: false, reason: 'The signature header could not be read.' };
    }

    const age = Math.abs(Date.now() / 1000 - Number.parseInt(timestamp, 10));

    if (!Number.isFinite(age) || age > MAX_SKEW_SECONDS) {
      return { isVerified: false, reason: 'The signature is too old to be trusted.' };
    }

    const expected = hmacHex(`${timestamp}.${rawBody}`, secret);
    const isVerified = signatures.some((candidate) => signaturesMatch(candidate, expected));

    return {
      isVerified,
      reason: isVerified ? null : 'The signature does not match the body that arrived.',
    };
  }

  // Everything else is checked as a plain keyed digest of the body, which is
  // what the remaining providers and any gateway added by configuration use.
  const expected = hmacHex(rawBody, secret);
  const candidate = header.includes('=') ? (header.split('=').pop() ?? header) : header;
  const isVerified = signaturesMatch(candidate.trim(), expected);

  return {
    isVerified,
    reason: isVerified ? null : 'The signature does not match the body that arrived.',
  };
}
