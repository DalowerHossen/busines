// src/lib/crypto/encryption.ts
// AES-256-GCM encryption for every secret stored in the database: SMTP
// passwords, gateway keys, webhook secrets and messaging tokens.

import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

import { serverEnv } from '@/lib/env/env.server';
import { AppError } from '@/lib/errors';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ENVELOPE_PREFIX = 'v1';

/**
 * Reads the encryption key and checks that it is the right size.
 *
 * @returns The 32 byte key.
 */
function encryptionKey(): Buffer {
  const raw = serverEnv.ENCRYPTION_KEY.trim();
  const decoded = Buffer.from(raw, 'base64');
  const key = decoded.length === KEY_BYTES ? decoded : Buffer.from(raw, 'utf8');

  if (key.length !== KEY_BYTES) {
    throw new AppError(
      'unexpected',
      'The encryption key must be 32 bytes, supplied as base64 or raw text.'
    );
  }

  return key;
}

/**
 * Encrypts text that must never be readable in the database.
 *
 * @param plainText Secret in clear text.
 * @returns An envelope of version, nonce, tag and ciphertext.
 */
export function encryptSecret(plainText: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

/**
 * Decrypts an envelope produced by encryptSecret.
 *
 * @param envelope Stored envelope.
 * @returns The secret in clear text.
 */
export function decryptSecret(envelope: string): string {
  const parts = envelope.split('.');

  if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX) {
    throw new AppError('unexpected', 'The stored secret is not in a readable format.');
  }

  const iv = Buffer.from(parts[1] ?? '', 'base64');
  const authTag = Buffer.from(parts[2] ?? '', 'base64');
  const ciphertext = Buffer.from(parts[3] ?? '', 'base64');

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new AppError('unexpected', 'The stored secret is not in a readable format.');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (caught) {
    throw new AppError('unexpected', 'The stored secret could not be decrypted.', {
      cause: caught,
    });
  }
}

/**
 * Encrypts a bundle of named credentials as one envelope.
 *
 * @param values Credential names and their clear text values.
 * @returns A single envelope holding the whole bundle.
 */
export function encryptCredentialBundle(values: Record<string, string>): string {
  return encryptSecret(JSON.stringify(values));
}

/**
 * Decrypts a bundle written by encryptCredentialBundle.
 *
 * @param envelope Stored envelope.
 * @returns The credential names and their clear text values.
 */
export function decryptCredentialBundle(envelope: string): Record<string, string> {
  const parsed: unknown = JSON.parse(decryptSecret(envelope));

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AppError('unexpected', 'The stored credential bundle is not in a readable format.');
  }

  const bundle: Record<string, string> = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      bundle[key] = value;
    }
  }

  return bundle;
}

/**
 * Compares two secrets without leaking their contents through timing.
 *
 * @param left First secret.
 * @param right Second secret.
 * @returns True when the two are identical.
 */
export function secretsMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
