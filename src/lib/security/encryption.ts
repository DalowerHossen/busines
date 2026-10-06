// src/lib/security/encryption.ts
// AES-256-GCM for server-side secret values. Ciphertext, nonce, and auth tag
// are stored together; plaintext and master-key material never leave this
// module in logs or error messages.
import 'server-only';

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const ENVELOPE_VERSION = 1;

export interface EncryptedSecretEnvelope {
  readonly version: 1;
  readonly algorithm: 'aes-256-gcm';
  readonly keyVersion: string;
  readonly nonce: string;
  readonly ciphertext: string;
  readonly authTag: string;
}

export class EncryptionError extends Error {
  readonly code: 'invalid_key' | 'invalid_envelope' | 'decryption_failed';

  constructor(code: EncryptionError['code']) {
    super('Secret encryption operation failed.');
    this.name = 'EncryptionError';
    this.code = code;
  }
}

export function encryptSecret(input: {
  readonly plaintext: string;
  readonly base64Key: string;
  readonly keyVersion: string;
}): EncryptedSecretEnvelope {
  if (!input.keyVersion.trim()) throw new EncryptionError('invalid_envelope');
  const key = decodeKey(input.base64Key);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(input.plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    version: ENVELOPE_VERSION,
    algorithm: ALGORITHM,
    keyVersion: input.keyVersion.trim(),
    nonce: nonce.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authTag: authTag.toString('base64url'),
  };
}

export function decryptSecret(input: {
  readonly envelope: EncryptedSecretEnvelope | string;
  readonly base64Key: string;
  readonly expectedKeyVersion?: string;
}): string {
  const envelope = parseEnvelope(input.envelope);
  if (input.expectedKeyVersion && envelope.keyVersion !== input.expectedKeyVersion) {
    throw new EncryptionError('invalid_envelope');
  }
  const key = decodeKey(input.base64Key);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, decodePart(envelope.nonce));
    decipher.setAuthTag(decodePart(envelope.authTag));
    return Buffer.concat([
      decipher.update(decodePart(envelope.ciphertext)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new EncryptionError('decryption_failed');
  }
}

export function serializeSecretEnvelope(envelope: EncryptedSecretEnvelope): string {
  return JSON.stringify(parseEnvelope(envelope));
}

export function fingerprintSecret(input: { readonly value: string; readonly key: string }): string {
  if (!input.key || !input.value) throw new EncryptionError('invalid_key');
  return createHmac('sha256', input.key).update(input.value, 'utf8').digest('hex');
}

function decodeKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== KEY_BYTES) throw new EncryptionError('invalid_key');
  return key;
}

function decodePart(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length === 0) throw new EncryptionError('invalid_envelope');
  return decoded;
}

function parseEnvelope(value: EncryptedSecretEnvelope | string): EncryptedSecretEnvelope {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new EncryptionError('invalid_envelope');
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new EncryptionError('invalid_envelope');
  }
  const envelope = parsed as Record<string, unknown>;
  if (
    envelope.version !== ENVELOPE_VERSION ||
    envelope.algorithm !== ALGORITHM ||
    typeof envelope.keyVersion !== 'string' ||
    typeof envelope.nonce !== 'string' ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.authTag !== 'string'
  ) {
    throw new EncryptionError('invalid_envelope');
  }
  if (envelope.keyVersion.length > 64) throw new EncryptionError('invalid_envelope');
  return envelope as unknown as EncryptedSecretEnvelope;
}
