// src/lib/storefronts/signatures.ts
// Proving that a notification really came from the shop it claims to.
//
// WooCommerce and Shopify both sign the raw body with a shared secret and
// send the result as base64, so one routine covers both. The comparison is
// constant time, because a signature check that leaks timing is not a check.

import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Header each platform puts its signature in. */
export const SIGNATURE_HEADERS: Readonly<Record<string, string>> = {
  woocommerce: 'x-wc-webhook-signature',
  shopify: 'x-shopify-hmac-sha256',
  custom: 'x-storefront-signature',
};

/**
 * Signs a body the way the shop platforms do.
 *
 * @param body Exactly the bytes that were sent.
 * @param secret Shared secret of the connection.
 * @returns The signature, base64 encoded.
 */
export function signStorefrontBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

/**
 * Checks a signature against the body that arrived.
 *
 * @param body Exactly the bytes that were sent.
 * @param secret Shared secret of the connection.
 * @param signature Signature the platform sent.
 * @returns True when the two match.
 */
export function storefrontSignatureMatches(
  body: string,
  secret: string,
  signature: string | null
): boolean {
  if (signature === null || signature.trim() === '') {
    return false;
  }

  const expected = Buffer.from(signStorefrontBody(body, secret), 'utf8');
  const received = Buffer.from(signature.trim(), 'utf8');

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

/**
 * Reads the signature a platform sent, whichever header it used.
 *
 * @param headers Headers of the incoming request.
 * @param platform Platform the connection belongs to.
 * @returns The signature, or null when none was sent.
 */
export function readStorefrontSignature(headers: Headers, platform: string): string | null {
  const named = SIGNATURE_HEADERS[platform];

  if (named !== undefined) {
    const value = headers.get(named);

    if (value !== null) {
      return value;
    }
  }

  for (const header of Object.values(SIGNATURE_HEADERS)) {
    const value = headers.get(header);

    if (value !== null) {
      return value;
    }
  }

  return null;
}
