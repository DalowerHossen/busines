// src/features/storage/queries/get-company-storage.ts
// Reading where the documents of one business are being kept.

import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface CompanyStorage {
  isConfigured: boolean;
  isOwnStorage: boolean;
  name: string;
  provider: string;
  folderReference: string | null;
  maxUploadBytes: number;
  lastVerifiedAt: string | null;
  lastError: string | null;
  fileCount: number;
  storedBytes: number;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY: CompanyStorage = {
  isConfigured: false,
  isOwnStorage: false,
  name: '',
  provider: 'local_disk',
  folderReference: null,
  maxUploadBytes: 0,
  lastVerifiedAt: null,
  lastError: null,
  fileCount: 0,
  storedBytes: 0,
  isDegraded: false,
};

/**
 * Reads where one business is keeping its documents.
 *
 * @param companyId Business being read.
 * @returns Where the files go, and whether the read failed.
 */
export async function loadCompanyStorage(companyId: string): Promise<CompanyStorage> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('company_storage_target', {
    p_company_id: companyId,
  });

  if (error || !isJsonObject(data)) {
    logger.error('The storage setting of a business could not be read', error, { companyId });

    return { ...EMPTY, isDegraded: true };
  }

  /**
   * Reads a number out of the answer.
   *
   * @param key Field being read.
   * @returns The number, or zero.
   */
  function whole(key: string): number {
    const value = isJsonObject(data) ? data[key] : null;

    return typeof value === 'number' ? value : Number(value ?? 0) || 0;
  }

  /**
   * Reads a string out of the answer.
   *
   * @param key Field being read.
   * @returns The value, or null.
   */
  function text(key: string): string | null {
    const value = isJsonObject(data) ? data[key] : null;

    return typeof value === 'string' && value !== '' ? value : null;
  }

  return {
    isConfigured: data['is_configured'] === true,
    isOwnStorage: data['is_own_storage'] === true,
    name: text('name') ?? 'Platform storage',
    provider: text('provider') ?? 'local_disk',
    folderReference: text('folder_reference'),
    maxUploadBytes: whole('max_upload_bytes'),
    lastVerifiedAt: text('last_verified_at'),
    lastError: text('last_error'),
    fileCount: whole('file_count'),
    storedBytes: whole('stored_bytes'),
    isDegraded: false,
  };
}
