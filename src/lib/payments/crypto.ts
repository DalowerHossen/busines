// src/lib/payments/crypto.ts
// Signature primitives shared by webhook adapters. Every comparison is
// constant-time after normalising the provider's encoded signature.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function hmacHex(algorithm: string, secret: string, value: string): string {
  return createHmac(algorithm, secret).update(value, 'utf8').digest('hex');
}

export function hmacBase64(algorithm: string, secret: Buffer, value: string): string {
  return createHmac(algorithm, secret).update(value, 'utf8').digest('base64');
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function parseJsonBody(rawBody: string, provider: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(rawBody);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('not an object');
    }
    return value as Record<string, unknown>;
  } catch {
    throw new Error(`${provider} webhook payload is invalid.`);
  }
}

export function headerValue(
  headers: Readonly<Record<string, string | undefined>>,
  name: string
): string | undefined {
  const wanted = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === wanted);
  return entry?.[1];
}
