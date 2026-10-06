// src/lib/storage/adapters/managed-bucket.ts
// The adapter for the managed bucket that comes with the database service.
//
// A small deployment that has not signed up for anything else can keep its
// files here, which is why it exists. It speaks its own small protocol, so
// it gets its own adapter rather than being forced into the bucket one.

import 'server-only';

import type {
  StorageAdapter,
  StorageHealth,
  StorageTargetConfig,
  UploadInstruction,
} from '@/lib/storage/types';

/**
 * Works out the base address of the managed storage service.
 *
 * @param target Store being addressed.
 * @returns The base address, without a trailing slash.
 */
function baseFor(target: StorageTargetConfig): string {
  const configured = target.endpointUrl ?? target.credentials['project_url'] ?? '';

  if (configured.trim() === '') {
    throw new Error('This file store needs the address of the storage service.');
  }

  return `${configured.replace(/\/+$/, '')}/storage/v1`;
}

/**
 * Reads the service key the managed service authenticates with.
 *
 * @param target Store being addressed.
 * @returns The key.
 */
function keyFor(target: StorageTargetConfig): string {
  const key = target.credentials['service_key'] ?? target.credentials['service_role_key'] ?? '';

  if (key === '') {
    throw new Error('This file store has no service key yet.');
  }

  return key;
}

export const managedBucketAdapter: StorageAdapter = {
  key: 'supabase',

  async createUploadInstruction(
    target: StorageTargetConfig,
    storageKey: string,
    mimeType: string
  ): Promise<UploadInstruction> {
    const response = await fetch(
      `${baseFor(target)}/object/upload/sign/${target.bucketName}/${storageKey}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${keyFor(target)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: target.signedUrlTtlSeconds }),
      }
    );

    if (!response.ok) {
      throw new Error('The storage service refused to agree that upload.');
    }

    const payload: unknown = await response.json();
    const signedPath =
      typeof payload === 'object' && payload !== null && 'url' in payload
        ? String((payload as { url: unknown }).url)
        : '';

    if (signedPath === '') {
      throw new Error('The storage service did not return an upload address.');
    }

    return {
      url: `${baseFor(target)}${signedPath.startsWith('/') ? signedPath : `/${signedPath}`}`,
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
    const response = await fetch(
      `${baseFor(target)}/object/sign/${target.bucketName}/${storageKey}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${keyFor(target)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: target.signedUrlTtlSeconds }),
      }
    );

    if (!response.ok) {
      throw new Error('The storage service refused to sign that download.');
    }

    const payload: unknown = await response.json();
    const signedPath =
      typeof payload === 'object' && payload !== null && 'signedURL' in payload
        ? String((payload as { signedURL: unknown }).signedURL)
        : '';

    if (signedPath === '') {
      throw new Error('The storage service did not return a download address.');
    }

    const suffix = downloadName === null ? '' : `&download=${encodeURIComponent(downloadName)}`;

    return `${baseFor(target)}${signedPath.startsWith('/') ? signedPath : `/${signedPath}`}${suffix}`;
  },

  async removeObject(target: StorageTargetConfig, storageKey: string): Promise<boolean> {
    const response = await fetch(`${baseFor(target)}/object/${target.bucketName}/${storageKey}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${keyFor(target)}` },
    });

    return response.ok || response.status === 404;
  },

  async checkHealth(target: StorageTargetConfig): Promise<StorageHealth> {
    try {
      const response = await fetch(`${baseFor(target)}/bucket/${target.bucketName}`, {
        headers: { authorization: `Bearer ${keyFor(target)}` },
      });

      if (response.ok) {
        return { isHealthy: true, message: 'The storage service answered and the bucket exists.' };
      }

      if (response.status === 404) {
        return { isHealthy: false, message: 'That bucket does not exist in the storage service.' };
      }

      return { isHealthy: false, message: 'The storage service rejected this service key.' };
    } catch {
      return { isHealthy: false, message: 'The storage service could not be reached.' };
    }
  },
};
