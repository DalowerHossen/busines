// src/lib/storage/adapters/cloud-drive.ts
// Keeping files in the cloud drive of the business itself.
//
// A drive is not a bucket: it names the object rather than letting us choose
// a key, and it has no notion of a signed address a stranger can follow.
// So uploads are handed to the browser as a resumable session, and reads are
// served by this application after it has checked who is asking.

import 'server-only';

import {
  checkDriveAccess,
  fetchDriveObject,
  findDriveFile,
  openDriveUpload,
  trashDriveObject,
  type DriveCredentials,
} from '@/lib/storage/drive/client';
import type {
  StorageAdapter,
  StorageHealth,
  StorageTargetConfig,
  UploadInstruction,
} from '@/lib/storage/types';

/**
 * Reads the permission of a drive connection, refusing a half configured one.
 *
 * @param target Store being used.
 * @returns The permission, ready to use.
 */
export function driveCredentialsFor(target: StorageTargetConfig): DriveCredentials {
  const clientId = target.credentials['client_id'] ?? '';
  const clientSecret = target.credentials['client_secret'] ?? '';
  const refreshToken = target.credentials['refresh_token'] ?? '';
  const folderId = target.credentials['folder_id'] ?? target.pathPrefix ?? '';

  if (clientId === '' || clientSecret === '' || refreshToken === '' || folderId === '') {
    throw new Error('This drive is not connected. Connect it again from the settings screen.');
  }

  return { clientId, clientSecret, refreshToken, folderId };
}

export const cloudDriveAdapter: StorageAdapter = {
  key: 'google_drive',

  async createUploadInstruction(
    target: StorageTargetConfig,
    storageKey: string,
    mimeType: string
  ): Promise<UploadInstruction> {
    const credentials = driveCredentialsFor(target);
    const fileName = storageKey.split('/').pop() ?? storageKey;
    const url = await openDriveUpload(credentials, storageKey, fileName, mimeType);

    return {
      url,
      method: 'PUT',
      headers: { 'content-type': mimeType },
      expiresAt: new Date(Date.now() + target.signedUrlTtlSeconds * 1000).toISOString(),
    };
  },

  async createDownloadUrl(
    _target: StorageTargetConfig,
    _storageKey: string,
    _downloadName: string | null
  ): Promise<string> {
    throw new Error('A drive is read through this application rather than by address.');
  },

  async removeObject(target: StorageTargetConfig, storageKey: string): Promise<boolean> {
    const credentials = driveCredentialsFor(target);
    const externalId = await findDriveFile(credentials, storageKey);

    if (externalId === null) {
      return true;
    }

    return trashDriveObject(credentials, externalId);
  },

  async checkHealth(target: StorageTargetConfig): Promise<StorageHealth> {
    try {
      return await checkDriveAccess(driveCredentialsFor(target));
    } catch (cause) {
      return {
        isHealthy: false,
        message: cause instanceof Error ? cause.message : 'That drive is not connected.',
      };
    }
  },

  async streamObject(
    target: StorageTargetConfig,
    objectReference: string
  ): Promise<Response | null> {
    const credentials = driveCredentialsFor(target);
    const externalId =
      objectReference.includes('/') === false
        ? objectReference
        : ((await findDriveFile(credentials, objectReference)) ?? '');

    if (externalId === '') {
      return null;
    }

    const response = await fetchDriveObject(credentials, externalId);

    return response.ok ? response : null;
  },
};
