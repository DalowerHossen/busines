// src/lib/storage/folder-store.ts
import type { SupabaseClient } from '@supabase/supabase-js';

import { StorageProviderError } from './errors';
import type { StorageProviderId } from '@/types/storage';

export interface StorageFolderStore {
  findCompanyFolder(companyId: string, providerId: StorageProviderId): Promise<string | null>;
  claimCompanyFolder(
    companyId: string,
    providerId: StorageProviderId,
    providerFolderId: string
  ): Promise<string>;
}

type StorageFolderRow = {
  provider_folder_id: string;
};

export function createSupabaseStorageFolderStore(client: SupabaseClient): StorageFolderStore {
  return {
    async findCompanyFolder(companyId, providerId) {
      const { data, error } = await client
        .from('storage_provider_folders')
        .select('provider_folder_id')
        .eq('company_id', companyId)
        .eq('provider_id', providerId)
        .maybeSingle<StorageFolderRow>();

      if (error) {
        throw new StorageProviderError('supabase', 'provider_request_failed', null, true);
      }

      return data?.provider_folder_id ?? null;
    },

    async claimCompanyFolder(companyId, providerId, providerFolderId) {
      const { error: upsertError } = await client.from('storage_provider_folders').upsert(
        {
          company_id: companyId,
          provider_id: providerId,
          provider_folder_id: providerFolderId,
        },
        { onConflict: 'company_id,provider_id', ignoreDuplicates: true }
      );

      if (upsertError) {
        throw new StorageProviderError('supabase', 'provider_request_failed', null, true);
      }

      const { data, error } = await client
        .from('storage_provider_folders')
        .select('provider_folder_id')
        .eq('company_id', companyId)
        .eq('provider_id', providerId)
        .single<StorageFolderRow>();

      if (error || !data?.provider_folder_id) {
        throw new StorageProviderError('supabase', 'provider_response_invalid');
      }

      return data.provider_folder_id;
    },
  };
}
