// src/lib/auth/recovery-codes.ts
// One time recovery codes, shown once when two factor authentication is set
// up and stored only as hashes.

import 'server-only';

import { randomCode, sha256Hex, signaturesMatch } from '@/lib/crypto/hashing';

const CODE_COUNT = 10;
const GROUP_LENGTH = 5;

/**
 * Formats a raw code into two readable groups.
 *
 * @param raw Raw characters drawn at random.
 * @returns A code such as "7K2PD-X49MT".
 */
function formatCode(raw: string): string {
  return `${raw.slice(0, GROUP_LENGTH)}-${raw.slice(GROUP_LENGTH)}`;
}

/**
 * Removes the formatting so two spellings of one code compare equal.
 *
 * @param code Code as typed by the account holder.
 * @returns The bare characters in uppercase.
 */
export function normaliseRecoveryCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Creates a fresh set of recovery codes.
 *
 * @returns The codes to show the account holder, formatted for reading.
 */
export function createRecoveryCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, () => formatCode(randomCode(GROUP_LENGTH * 2)));
}

/**
 * Hashes a code for storage.
 *
 * @param code Code in either formatted or bare form.
 * @returns The hash to store.
 */
export function hashRecoveryCode(code: string): string {
  return sha256Hex(normaliseRecoveryCode(code));
}

/**
 * Hashes a whole set of codes for storage.
 *
 * @param codes Codes shown to the account holder.
 * @returns The hashes to store.
 */
export function hashRecoveryCodes(codes: readonly string[]): string[] {
  return codes.map((code) => hashRecoveryCode(code));
}

/**
 * Finds the stored hash matching a submitted code.
 *
 * @param submitted Code typed by the account holder.
 * @param storedHashes Hashes held against the account.
 * @returns The hash that matched, or null when none did.
 */
export function findMatchingRecoveryHash(
  submitted: string,
  storedHashes: readonly string[]
): string | null {
  const candidate = hashRecoveryCode(submitted);

  for (const stored of storedHashes) {
    if (signaturesMatch(candidate, stored)) {
      return stored;
    }
  }

  return null;
}
