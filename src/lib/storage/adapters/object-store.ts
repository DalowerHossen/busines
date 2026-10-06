// src/lib/storage/adapters/object-store.ts
// The adapter for every object store that speaks the common bucket protocol.
//
// One implementation serves the content delivery store the platform ships
// with, the large cloud one, and the two cheap ones, because the difference
// between them is a host name and a region rather than a protocol.

import 'server-only';

import { presignObjectUrl } from '@/lib/storage/signing';
import type {
  StorageAdapter,
  StorageHealth,
  StorageTargetConfig,
  UploadInstruction,
} from '@/lib/storage/types';

/** Region assumed when a store does not care which one is named. */
const DEFAULT_REGION = 'auto';

/**
 * Works out the host the bucket is reached on.
 *
 * @param target Store being addressed.
 * @returns The host name, without a scheme.
 */
function hostFor(target: StorageTargetConfig): string {
  if (target.endpointUrl !== null && target.endpointUrl.trim() !== '') {
    const host = target.endpointUrl.replace(/^https:\/\//, '').replace(/\/+$/, '');

    return target.forcePathStyle ? host : `${target.bucketName}.${host}`;
  }

  const region = target.region ?? DEFAULT_REGION;

  return target.forcePathStyle
    ? `s3.${region}.amazonaws.com`
    : `${target.bucketName}.s3.${region}.amazonaws.com`;
}

/**
 * Works out the path inside that host.
 *
 * @param target Store being addressed.
 * @param storageKey Key of the object.
 * @returns The path, without a leading slash.
 */
function pathFor(target: StorageTargetConfig, storageKey: string): string {
  return target.forcePathStyle ? `${target.bucketName}/${storageKey}` : storageKey;
}

/**
 * Reads the credential pair out of the bundle, whatever it was named.
 *
 * @param target Store being addressed.
 * @returns The pair, or null when the store has not been keyed yet.
 */
function credentialsFor(
  target: StorageTargetConfig
): { accessKeyId: string; secretAccessKey: string } | null {
  const accessKeyId = target.credentials['access_key_id'] ?? target.credentials['accessKeyId'];
  const secretAccessKey =
    target.credentials['secret_access_key'] ?? target.credentials['secretAccessKey'];

  if (
    accessKeyId === undefined ||
    secretAccessKey === undefined ||
    accessKeyId === '' ||
    secretAccessKey === ''
  ) {
    return null;
  }

  return { accessKeyId, secretAccessKey };
}

export const objectStoreAdapter: StorageAdapter = {
  key: 'cloudflare_r2',

  async createUploadInstruction(
    target: StorageTargetConfig,
    storageKey: string,
    mimeType: string
  ): Promise<UploadInstruction> {
    const pair = credentialsFor(target);

    if (pair === null) {
      throw new Error('This file store has no keys yet. Add them in the admin panel first.');
    }

    const url = presignObjectUrl({
      method: 'PUT',
      host: hostFor(target),
      path: pathFor(target, storageKey),
      region: target.region ?? DEFAULT_REGION,
      accessKeyId: pair.accessKeyId,
      secretAccessKey: pair.secretAccessKey,
      expiresInSeconds: target.signedUrlTtlSeconds,
      signedHeaders: { 'content-type': mimeType },
    });

    return {
      url,
      method: 'PUT',
      headers: { 'content-type': mimeType },
      expiresAt: new Date(Date.now() + target.signedUrlTtlSeconds * 1000).toISOString(),
    };
  },

  async createDownloadUrl(
    target: StorageTargetConfig,
    storageKey: string,
    downloadName: string | null
  ): Promise<string> {
    const pair = credentialsFor(target);

    if (pair === null) {
      throw new Error('This file store has no keys yet. Add them in the admin panel first.');
    }

    const disposition =
      downloadName === null
        ? undefined
        : { 'response-content-disposition': `attachment; filename="${downloadName}"` };

    return presignObjectUrl({
      method: 'GET',
      host: hostFor(target),
      path: pathFor(target, storageKey),
      region: target.region ?? DEFAULT_REGION,
      accessKeyId: pair.accessKeyId,
      secretAccessKey: pair.secretAccessKey,
      expiresInSeconds: target.signedUrlTtlSeconds,
      query: disposition,
    });
  },

  async removeObject(target: StorageTargetConfig, storageKey: string): Promise<boolean> {
    const pair = credentialsFor(target);

    if (pair === null) {
      return false;
    }

    const url = presignObjectUrl({
      method: 'DELETE',
      host: hostFor(target),
      path: pathFor(target, storageKey),
      region: target.region ?? DEFAULT_REGION,
      accessKeyId: pair.accessKeyId,
      secretAccessKey: pair.secretAccessKey,
      expiresInSeconds: 120,
    });

    const response = await fetch(url, { method: 'DELETE' });

    return response.ok || response.status === 404;
  },

  async checkHealth(target: StorageTargetConfig): Promise<StorageHealth> {
    const pair = credentialsFor(target);

    if (pair === null) {
      return { isHealthy: false, message: 'This store has no keys yet.' };
    }

    const url = presignObjectUrl({
      method: 'GET',
      host: hostFor(target),
      path: pathFor(target, 'health-check-probe'),
      region: target.region ?? DEFAULT_REGION,
      accessKeyId: pair.accessKeyId,
      secretAccessKey: pair.secretAccessKey,
      expiresInSeconds: 60,
    });

    try {
      const response = await fetch(url, { method: 'GET' });

      if (response.status === 403) {
        return { isHealthy: false, message: 'The store rejected these keys.' };
      }

      return {
        isHealthy: true,
        message:
          response.status === 404
            ? 'The store answered. The bucket is reachable and empty at that key.'
            : 'The store answered and the keys were accepted.',
      };
    } catch {
      return { isHealthy: false, message: 'The store could not be reached from this server.' };
    }
  },
};
