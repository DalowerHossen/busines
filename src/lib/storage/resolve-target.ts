// src/lib/storage/resolve-target.ts
// Turning the stored settings of a file store into something usable.
//
// Credentials follow the same order as every other integration: whatever the
// database holds, encrypted, comes first; the environment is the fallback;
// the built in default is last. Nothing here is cached beyond the call, so a
// key changed in the admin panel applies to the very next upload.

import 'server-only';

import { serverEnv } from '@/env/server';
import { decryptCredentialBundle } from '@/lib/crypto/encryption';
import { logger } from '@/lib/logger';
import { cloudDriveAdapter } from '@/lib/storage/adapters/cloud-drive';
import { localDiskAdapter } from '@/lib/storage/adapters/local-disk';
import { managedBucketAdapter } from '@/lib/storage/adapters/managed-bucket';
import { objectStoreAdapter } from '@/lib/storage/adapters/object-store';
import type { StorageAdapter, StorageProviderKey, StorageTargetConfig } from '@/lib/storage/types';
import { isJsonObject, type JsonObject } from '@/types/json';

const PROVIDERS: readonly StorageProviderKey[] = [
  'supabase',
  'google_drive',
  'cloudflare_r2',
  'aws_s3',
  'backblaze_b2',
  'wasabi',
  'local_disk',
];

/**
 * Returns the adapter that speaks to one kind of store.
 *
 * @param provider Kind of store.
 * @returns The adapter for it.
 */
export function storageAdapterFor(provider: StorageProviderKey): StorageAdapter {
  if (provider === 'local_disk') {
    return localDiskAdapter;
  }

  if (provider === 'supabase') {
    return managedBucketAdapter;
  }

  if (provider === 'google_drive') {
    return cloudDriveAdapter;
  }

  return objectStoreAdapter;
}

/**
 * Reads a string out of a settings record.
 *
 * @param source The settings.
 * @param key Field being read.
 * @returns The value, or null.
 */
function text(source: JsonObject, key: string): string | null {
  const value = source[key];

  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Reads the credentials of a store, falling back to the environment.
 *
 * @param source The settings as the database returned them.
 * @returns The credentials in clear text.
 */
function credentialsFrom(source: JsonObject): Record<string, string> {
  const envelope = text(source, 'credentials_encrypted');
  const previous = text(source, 'previous_credentials_encrypted');
  const graceEnds = text(source, 'previous_credentials_valid_until');

  const identity: Record<string, string> = {};

  if (serverEnv.GOOGLE_DRIVE_CLIENT_ID !== undefined) {
    identity['client_id'] = serverEnv.GOOGLE_DRIVE_CLIENT_ID;
  }

  if (serverEnv.GOOGLE_DRIVE_CLIENT_SECRET !== undefined) {
    identity['client_secret'] = serverEnv.GOOGLE_DRIVE_CLIENT_SECRET;
  }

  if (envelope !== null) {
    try {
      return { ...identity, ...decryptCredentialBundle(envelope) };
    } catch (cause) {
      logger.error('The stored file store keys could not be read', cause);

      if (previous !== null && graceEnds !== null && new Date(graceEnds).getTime() > Date.now()) {
        return { ...identity, ...decryptCredentialBundle(previous) };
      }
    }
  }

  const fallback: Record<string, string> = {};

  if (serverEnv.STORAGE_S3_ACCESS_KEY_ID !== undefined) {
    fallback['access_key_id'] = serverEnv.STORAGE_S3_ACCESS_KEY_ID;
  }

  if (serverEnv.STORAGE_S3_SECRET_ACCESS_KEY !== undefined) {
    fallback['secret_access_key'] = serverEnv.STORAGE_S3_SECRET_ACCESS_KEY;
  }

  if (serverEnv.GOOGLE_DRIVE_CLIENT_ID !== undefined) {
    fallback['client_id'] = serverEnv.GOOGLE_DRIVE_CLIENT_ID;
  }

  if (serverEnv.GOOGLE_DRIVE_CLIENT_SECRET !== undefined) {
    fallback['client_secret'] = serverEnv.GOOGLE_DRIVE_CLIENT_SECRET;
  }

  return fallback;
}

/**
 * Turns the settings the database returned into a usable store.
 *
 * @param source The settings as the database returned them.
 * @returns The store, ready to sign with.
 */
export function storageTargetFrom(source: unknown): StorageTargetConfig {
  if (!isJsonObject(source)) {
    throw new Error('No storage has been configured for this account.');
  }

  const providerName = text(source, 'provider') ?? 'local_disk';
  const provider = PROVIDERS.find((candidate) => candidate === providerName) ?? 'local_disk';
  const ttl = source['signed_url_ttl_seconds'];

  return {
    targetId: text(source, 'target_id') ?? '',
    pathPrefix: text(source, 'path_prefix'),
    provider,
    bucketName: text(source, 'bucket_name') ?? serverEnv.STORAGE_S3_BUCKET ?? 'files',
    region: text(source, 'region') ?? serverEnv.STORAGE_S3_REGION,
    endpointUrl: text(source, 'endpoint_url') ?? serverEnv.STORAGE_S3_ENDPOINT ?? null,
    publicBaseUrl: text(source, 'public_base_url'),
    forcePathStyle: source['force_path_style'] === true,
    signedUrlTtlSeconds: typeof ttl === 'number' && ttl > 0 ? ttl : 900,
    credentials: credentialsFrom(source),
  };
}
