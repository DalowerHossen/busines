import { backupCipherFailed, backupIntegrityFailed, invalidCoreRequest } from './errors';
import type {
  BackupArtifact,
  BackupArtifactStore,
  BackupCipher,
  BackupEntityCollection,
  JsonBackupPayload,
} from './types';

const REDACTED_BACKUP_KEYS = new Set([
  'password',
  'password_hash',
  'secret',
  'secret_key',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'key_hash',
  'private_key',
  'value_encrypted',
  'account_details_encrypted',
  'raw_card_number',
  'card_number',
  'pan',
  'cvv',
  'cvc',
]);

export function buildJsonBackupPayload(input: {
  readonly companyId: string | null;
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly collections: readonly BackupEntityCollection[];
}): JsonBackupPayload {
  if (
    (input.companyId !== null && !input.companyId.trim()) ||
    !input.schemaVersion.trim() ||
    !Number.isFinite(Date.parse(input.generatedAt))
  ) {
    throw invalidCoreRequest();
  }
  const redactedFieldNames = new Set<string>();
  const collections = input.collections
    .map((collection) => {
      if (!/^[a-z][a-z0-9_]{0,63}$/u.test(collection.entityType)) {
        throw invalidCoreRequest();
      }
      return {
        entityType: collection.entityType,
        rows: collection.rows
          .map((row) => sanitizeBackupValue(row, redactedFieldNames))
          .sort((left, right) => canonicalize(left).localeCompare(canonicalize(right))),
      };
    })
    .sort((left, right) => left.entityType.localeCompare(right.entityType));
  return {
    artifactType: input.companyId === null ? 'platform-json-backup' : 'tenant-json-backup',
    schemaVersion: input.schemaVersion.trim(),
    companyId: input.companyId,
    generatedAt: input.generatedAt,
    collections,
    redactedFieldNames: [...redactedFieldNames].sort(),
  };
}

export async function createEncryptedBackup(input: {
  readonly payload: JsonBackupPayload;
  readonly keyVersion: string;
  readonly cipher: BackupCipher;
  readonly store: BackupArtifactStore;
}): Promise<BackupArtifact> {
  if (!input.keyVersion.trim()) throw invalidCoreRequest();
  const plaintext = encode(canonicalize(input.payload));
  const contentSha256 = await sha256(plaintext);
  let encryptedContent: Uint8Array;
  try {
    encryptedContent = await input.cipher.encrypt({
      plaintext,
      keyVersion: input.keyVersion,
    });
  } catch {
    throw backupCipherFailed();
  }
  const artifact: BackupArtifact = {
    companyId: input.payload.companyId,
    schemaVersion: input.payload.schemaVersion,
    generatedAt: input.payload.generatedAt,
    keyVersion: input.keyVersion,
    contentSha256,
    encryptedContent,
    sizeBytes: encryptedContent.byteLength,
  };
  return input.store.save(artifact);
}

export async function restoreEncryptedBackup(input: {
  readonly artifact: BackupArtifact;
  readonly expectedCompanyId: string | null;
  readonly cipher: BackupCipher;
}): Promise<JsonBackupPayload> {
  if (input.artifact.companyId !== input.expectedCompanyId) throw invalidCoreRequest();
  let plaintext: Uint8Array;
  try {
    plaintext = await input.cipher.decrypt({
      ciphertext: input.artifact.encryptedContent,
      keyVersion: input.artifact.keyVersion,
    });
  } catch {
    throw backupCipherFailed();
  }
  if ((await sha256(plaintext)) !== input.artifact.contentSha256) {
    throw backupIntegrityFailed();
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
  } catch {
    throw backupIntegrityFailed();
  }
  if (!isJsonBackupPayload(decoded) || decoded.schemaVersion !== input.artifact.schemaVersion) {
    throw backupIntegrityFailed();
  }
  return decoded;
}

function sanitizeBackupValue(
  value: Readonly<Record<string, unknown>>,
  redactedFieldNames: Set<string>
): Readonly<Record<string, unknown>> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (REDACTED_BACKUP_KEYS.has(key.toLowerCase())) {
      redactedFieldNames.add(key);
      continue;
    }
    sanitized[key] = sanitizeNestedValue(nestedValue, redactedFieldNames);
  }
  return sanitized;
}

function sanitizeNestedValue(value: unknown, redactedFieldNames: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'object' && item !== null && !Array.isArray(item)
        ? sanitizeBackupValue(item as Readonly<Record<string, unknown>>, redactedFieldNames)
        : sanitizeNestedValue(item, redactedFieldNames)
    );
  }
  if (typeof value !== 'object' || value === null) return value;
  return sanitizeBackupValue(value as Readonly<Record<string, unknown>>, redactedFieldNames);
}

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (typeof value !== 'object') throw invalidCoreRequest();
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isJsonBackupPayload(value: unknown): value is JsonBackupPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.artifactType === 'tenant-json-backup' ||
      record.artifactType === 'platform-json-backup') &&
    typeof record.schemaVersion === 'string' &&
    (typeof record.companyId === 'string' || record.companyId === null) &&
    typeof record.generatedAt === 'string' &&
    Array.isArray(record.collections) &&
    Array.isArray(record.redactedFieldNames)
  );
}
