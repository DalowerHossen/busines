// src/lib/auth/two-factor.ts
// Time based one time passwords, as used by every authenticator application.
// Implemented against RFC 6238 with the standard thirty second step and a one
// step window so a slightly wrong clock still works.

import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { BRAND } from '@/config/brand';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS = 6;
const STEP_SECONDS = 30;
const ALLOWED_DRIFT_STEPS = 1;

/**
 * Encodes bytes as base32 without padding, the form authenticators expect.
 *
 * @param input Bytes to encode.
 * @returns The base32 text.
 */
function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET.charAt((value << (5 - bits)) & 31);
  }

  return output;
}

/**
 * Decodes base32 text back into bytes.
 *
 * @param input Base32 text, with or without padding and spaces.
 * @returns The decoded bytes.
 */
function decodeBase32(input: string): Buffer {
  const cleaned = input.replace(/[=\s]/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index < 0) {
      continue;
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Computes the code for one time step.
 *
 * @param secret Shared secret in base32.
 * @param counter Number of time steps since the epoch.
 * @returns The six digit code.
 */
function codeForCounter(secret: string, counter: number): string {
  const key = decodeBase32(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.max(0, Math.floor(counter))));

  const digest = createHmac('sha1', key).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 15;
  const binary =
    (((digest[offset] ?? 0) & 127) << 24) |
    (((digest[offset + 1] ?? 0) & 255) << 16) |
    (((digest[offset + 2] ?? 0) & 255) << 8) |
    ((digest[offset + 3] ?? 0) & 255);

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/**
 * Creates a new shared secret for an account.
 *
 * @returns The secret in base32, ready to show as a key or a QR code.
 */
export function createTwoFactorSecret(): string {
  return encodeBase32(randomBytes(20));
}

/**
 * Builds the otpauth address an authenticator scans.
 *
 * @param secret Shared secret in base32.
 * @param accountEmail Email address shown inside the authenticator.
 * @returns The otpauth address.
 */
export function buildOtpAuthUrl(secret: string, accountEmail: string): string {
  const issuer = encodeURIComponent(BRAND.name);
  const label = encodeURIComponent(`${BRAND.name}:${accountEmail}`);

  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/**
 * Returns the code that is valid right now, used for tests and support.
 *
 * @param secret Shared secret in base32.
 * @param atMilliseconds Point in time to compute for.
 * @returns The six digit code.
 */
export function currentTwoFactorCode(secret: string, atMilliseconds = Date.now()): string {
  return codeForCounter(secret, Math.floor(atMilliseconds / 1000 / STEP_SECONDS));
}

/**
 * Checks a code supplied by the account holder.
 *
 * @param secret Shared secret in base32.
 * @param submittedCode Code typed by the account holder.
 * @param atMilliseconds Point in time to check against.
 * @returns True when the code is valid for the current or an adjacent step.
 */
export function verifyTwoFactorCode(
  secret: string,
  submittedCode: string,
  atMilliseconds = Date.now()
): boolean {
  const cleaned = submittedCode.replace(/\D/g, '');

  if (cleaned.length !== DIGITS) {
    return false;
  }

  const counter = Math.floor(atMilliseconds / 1000 / STEP_SECONDS);

  for (let drift = -ALLOWED_DRIFT_STEPS; drift <= ALLOWED_DRIFT_STEPS; drift += 1) {
    const expected = Buffer.from(codeForCounter(secret, counter + drift), 'utf8');
    const supplied = Buffer.from(cleaned, 'utf8');

    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns how many seconds the current code remains valid for.
 *
 * @param atMilliseconds Point in time to measure from.
 * @returns Seconds until the next code.
 */
export function secondsUntilNextCode(atMilliseconds = Date.now()): number {
  return STEP_SECONDS - (Math.floor(atMilliseconds / 1000) % STEP_SECONDS);
}
