// src/lib/webhooks/signature.ts
// Proving that an event really came from this platform.
//
// The receiving end has no other way to know. A signature over the exact
// body and a timestamp lets them check both that we sent it and that it is
// not a replay of something we sent last week.

import 'server-only';

import { hmacHex } from '@/lib/crypto/hashing';

export interface SignedPayload {
  /** The exact bytes to send, which are also the bytes that were signed. */
  body: string;
  /** The header value the receiver verifies. */
  signature: string;
  /** When it was signed, in seconds. */
  timestamp: number;
}

/**
 * Signs one event body with the secret of its endpoint.
 *
 * @param body The exact body being sent.
 * @param secret The signing secret of the endpoint.
 * @returns The body, the signature header and the timestamp.
 */
export function signWebhookBody(body: string, secret: string): SignedPayload {
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = hmacHex(`${String(timestamp)}.${body}`, secret);

  return {
    body,
    signature: `t=${String(timestamp)},v1=${digest}`,
    timestamp,
  };
}
