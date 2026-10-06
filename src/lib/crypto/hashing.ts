// src/lib/crypto/hashing.ts
// Hashes and signatures: webhook verification, file deduplication, API key
// fingerprints and anything else that must be compared without being stored.

import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Hashes text with SHA-256.
 *
 * @param value Text to hash.
 * @returns The hash as lowercase hexadecimal.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Hashes binary content with SHA-256, used to deduplicate uploads.
 *
 * @param content File content.
 * @returns The hash as lowercase hexadecimal.
 */
export function sha256OfBuffer(content: Buffer | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Signs text with a shared secret.
 *
 * @param value Text to sign.
 * @param secret Shared secret.
 * @returns The signature as lowercase hexadecimal.
 */
export function hmacHex(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

/**
 * Signs text with a shared secret and encodes the result for a URL.
 *
 * @param value Text to sign.
 * @param secret Shared secret.
 * @returns The signature in base64url form.
 */
export function hmacBase64Url(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('base64url');
}

/**
 * Signs text with a key that is written in hexadecimal, as Adyen publishes
 * its notification keys, and returns the signature the way Adyen sends it.
 *
 * @param value Text to sign.
 * @param hexKey Shared key, written in hexadecimal.
 * @returns The signature in standard base64 form.
 */
export function hmacBase64WithHexKey(value: string, hexKey: string): string {
  return createHmac('sha256', Buffer.from(hexKey, 'hex')).update(value, 'utf8').digest('base64');
}

/**
 * Compares two signatures without leaking their contents through timing.
 *
 * @param left First signature.
 * @param right Second signature.
 * @returns True when the signatures match.
 */
export function signaturesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Generates a random secret suitable for an API key or a webhook.
 *
 * @param byteLength How many random bytes to draw.
 * @returns The secret in base64url form.
 */
export function randomSecret(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

/**
 * Generates a short code made of unambiguous uppercase characters.
 *
 * @param length How many characters the code should have.
 * @returns The generated code.
 */
export function randomCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let code = '';

  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index] ?? 0;
    code += alphabet.charAt(byte % alphabet.length);
  }

  return code;
}

/**
 * Builds the short hint shown beside a stored key so a person can recognise it.
 *
 * @param secret Secret in clear text.
 * @returns The last six characters of the secret.
 */
export function secretHint(secret: string): string {
  return secret.slice(-6);
}
