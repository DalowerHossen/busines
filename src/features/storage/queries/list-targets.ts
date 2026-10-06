// src/features/storage/queries/list-targets.ts
// Reading every configured file store and how it has been behaving.

import type { StorageTargetSummary } from '@/features/storage/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface StorageTargetListResult {
  targets: readonly StorageTargetSummary[];
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Reads every file store the platform knows about.
 *
 * @returns The stores and whether the read failed.
 */
export async function loadStorageTargets(): Promise<StorageTargetListResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('platform_storage_targets');

  if (error) {
    logger.error('The file stores could not be read', error);

    return { targets: [], isDegraded: true };
  }

  return {
    targets: asRows(data).map((row) => ({
      targetId: readString(row, 'target_id') ?? '',
      companyId: readString(row, 'company_id'),
      name: readString(row, 'name') ?? '',
      provider: readString(row, 'provider') ?? 'local_disk',
      isDefault: readBoolean(row, 'is_default'),
      isActive: readBoolean(row, 'is_active', true),
      bucketName: readString(row, 'bucket_name') ?? '',
      region: readString(row, 'region'),
      endpointUrl: readString(row, 'endpoint_url'),
      pathPrefix: readString(row, 'path_prefix'),
      publicBaseUrl: readString(row, 'public_base_url'),
      forcePathStyle: readBoolean(row, 'force_path_style'),
      signedUrlTtlSeconds: readNumber(row, 'signed_url_ttl_seconds') ?? 900,
      maxUploadBytes: readNumber(row, 'max_upload_bytes') ?? 0,
      hasCredentials: readBoolean(row, 'has_credentials'),
      credentialsFingerprint: readString(row, 'credentials_fingerprint'),
      lastUsedAt: readString(row, 'last_used_at'),
      lastVerifiedAt: readString(row, 'last_verified_at'),
      lastError: readString(row, 'last_error'),
      lastErrorAt: readString(row, 'last_error_at'),
      fileCount: readNumber(row, 'file_count') ?? 0,
      storedBytes: readNumber(row, 'stored_bytes') ?? 0,
    })),
    isDegraded: false,
  };
}
