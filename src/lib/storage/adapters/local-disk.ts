// src/lib/storage/adapters/local-disk.ts
// Keeping files on the disk of the machine the application runs on.
//
// This is what a self hosted installation uses before anybody has signed up
// to an object store. The browser still uploads directly, but the address it
// uploads to is one of ours, and the permission to write is a short lived
// signature rather than a session.

import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

import { serverEnv } from '@/lib/env/env.server';
import type {
  StorageAdapter,
  StorageHealth,
  StorageTargetConfig,
  UploadInstruction,
} from '@/lib/storage/types';

/** Folder on disk every local object is written under. */
const ROOT = join(process.cwd(), '.file-store');

/**
 * Turns a storage key into a path on disk, refusing anything that climbs out
 * of the folder we own.
 *
 * @param storageKey Key of the object.
 * @returns The absolute path the bytes belong at.
 */
export function localPathFor(storageKey: string): string {
  const path = normalize(join(ROOT, storageKey));

  if (!path.startsWith(`${ROOT}${sep}`)) {
    throw new Error('That file path is not allowed.');
  }

  return path;
}

/**
 * Signs permission to read or write one key for a limited time.
 *
 * @param storageKey Key being granted.
 * @param action What is being allowed.
 * @param expiresAt Unix seconds the permission runs out at.
 * @returns The signature.
 */
export function signLocalGrant(storageKey: string, action: string, expiresAt: number): string {
  return createHmac('sha256', serverEnv.ENCRYPTION_KEY)
    .update(`${action}:${storageKey}:${String(expiresAt)}`)
    .digest('hex');
}

/**
 * Checks permission presented against one key.
 *
 * @param storageKey Key being read or written.
 * @param action What is being attempted.
 * @param expiresAt Unix seconds the permission claims to run out at.
 * @param signature Signature presented.
 * @returns True when the permission is good and still in date.
 */
export function localGrantIsValid(
  storageKey: string,
  action: string,
  expiresAt: number,
  signature: string
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) {
    return false;
  }

  const expected = Buffer.from(signLocalGrant(storageKey, action, expiresAt), 'utf8');
  const received = Buffer.from(signature, 'utf8');

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

/**
 * Writes bytes to disk under one key.
 *
 * @param storageKey Key of the object.
 * @param content The bytes.
 * @returns How many bytes were written.
 */
export async function writeLocalObject(storageKey: string, content: Buffer): Promise<number> {
  const path = localPathFor(storageKey);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);

  return content.byteLength;
}

/**
 * Builds the address a browser uses for one local object.
 *
 * @param storageKey Key of the object.
 * @param action What is being allowed.
 * @param ttlSeconds How long the permission lasts.
 * @returns The relative address, signature included.
 */
function localUrl(storageKey: string, action: string, ttlSeconds: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = signLocalGrant(storageKey, action, expiresAt);
  const query = new URLSearchParams({
    key: storageKey,
    action,
    expires: String(expiresAt),
    signature,
  });

  return `/api/files/local?${query.toString()}`;
}

export const localDiskAdapter: StorageAdapter = {
  key: 'local_disk',

  async createUploadInstruction(
    target: StorageTargetConfig,
    storageKey: string,
    mimeType: string
  ): Promise<UploadInstruction> {
    return {
      url: localUrl(storageKey, 'write', target.signedUrlTtlSeconds),
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
    const base = localUrl(storageKey, 'read', target.signedUrlTtlSeconds);

    return downloadName === null ? base : `${base}&download=${encodeURIComponent(downloadName)}`;
  },

  async removeObject(_target: StorageTargetConfig, storageKey: string): Promise<boolean> {
    await rm(localPathFor(storageKey), { force: true });

    return true;
  },

  async checkHealth(_target: StorageTargetConfig): Promise<StorageHealth> {
    try {
      await mkdir(ROOT, { recursive: true });
      const details = await stat(ROOT);

      return details.isDirectory()
        ? { isHealthy: true, message: 'Files are being kept on the disk of this server.' }
        : { isHealthy: false, message: 'The file folder on this server is not a folder.' };
    } catch {
      return { isHealthy: false, message: 'This server cannot write to its own file folder.' };
    }
  },
};
