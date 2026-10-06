// src/lib/storage/factory.ts
// The only application entry point for storage providers. Future providers
// must be implemented explicitly before they can be selected.
import 'server-only';

import type { StorageAdapter, StorageProviderId } from '@/types/storage';
import { serverEnv } from '@/lib/env/env.server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

import { StorageProviderError } from './errors';
import { createSupabaseStorageFolderStore, type StorageFolderStore } from './folder-store';
import { createGoogleDriveStorageAdapter, type GoogleDriveStorageConfig } from './google-drive';

export interface StorageFactoryOptions {
  readonly providerId?: StorageProviderId;
  readonly folderStore?: StorageFolderStore;
  readonly googleDriveConfig?: GoogleDriveStorageConfig;
}

function createGoogleDriveConfig(): GoogleDriveStorageConfig {
  const { GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_ROOT_FOLDER_ID } =
    serverEnv;

  if (!GOOGLE_DRIVE_CLIENT_EMAIL || !GOOGLE_DRIVE_PRIVATE_KEY || !GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    throw new StorageProviderError('google_drive', 'invalid_configuration');
  }

  return {
    clientEmail: GOOGLE_DRIVE_CLIENT_EMAIL,
    privateKey: GOOGLE_DRIVE_PRIVATE_KEY,
    rootFolderId: GOOGLE_DRIVE_ROOT_FOLDER_ID,
    applicationUrl: serverEnv.NEXT_PUBLIC_APP_URL,
    linkSigningSecret: serverEnv.LINK_SIGNING_SECRET,
  };
}

export function createStorageAdapter(options: StorageFactoryOptions = {}): StorageAdapter {
  const providerId = options.providerId ?? serverEnv.STORAGE_PROVIDER;

  switch (providerId) {
    case 'google_drive': {
      const folderStore =
        options.folderStore ?? createSupabaseStorageFolderStore(getServiceSupabaseClient());
      return createGoogleDriveStorageAdapter(
        options.googleDriveConfig ?? createGoogleDriveConfig(),
        folderStore
      );
    }
    case 'supabase':
    case 'r2':
    case 's3':
    case 'b2':
    case 'wasabi':
    case 'local':
      throw new StorageProviderError(providerId, 'unsupported_provider');
    default:
      throw new StorageProviderError(String(providerId), 'unsupported_provider');
  }
}
