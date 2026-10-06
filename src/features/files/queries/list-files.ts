// src/features/files/queries/list-files.ts
// Reading what a business is storing, and how much of its allowance is left.

import type { StorageSummary, StoredFile, UploadPolicy } from '@/features/files/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type JsonObject } from '@/types/json';

export interface FileLibraryResult {
  files: readonly StoredFile[];
  summary: StorageSummary;
  policy: UploadPolicy;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_SUMMARY: StorageSummary = {
  quotaBytes: 0,
  usedBytes: 0,
  fileCount: 0,
  archivedCount: 0,
  orphanCount: 0,
  openUploadCount: 0,
  usedPercentage: 0,
};

const EMPTY_POLICY: UploadPolicy = {
  provider: 'local_disk',
  maxUploadBytes: 0,
  allowedMimeTypes: [],
  isConfigured: false,
};

/**
 * Reads a whole number out of a settings record.
 *
 * @param source The record.
 * @param key Field being read.
 * @returns The number, or zero.
 */
function whole(source: JsonObject, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Reads the library, the numbers and the upload rules in one pass.
 *
 * @param companyId Business whose files are being read.
 * @param purpose Optional kind of file to narrow to.
 * @param search Optional text to match on the name.
 * @returns The files, the numbers, the rules and whether the read failed.
 */
export async function loadFileLibrary(
  companyId: string,
  purpose: string | null = null,
  search: string | null = null
): Promise<FileLibraryResult> {
  const supabase = createServerSupabaseClient();

  const [files, summary, policy] = await Promise.all([
    supabase.rpc('company_files', {
      p_company_id: companyId,
      p_purpose: purpose,
      p_search: search,
      p_limit: 60,
    }),
    supabase.rpc('company_storage_summary', { p_company_id: companyId }),
    supabase.rpc('storage_upload_policy', { p_company_id: companyId }),
  ]);

  if (files.error || summary.error || policy.error) {
    logger.error(
      'The file library could not be read',
      files.error ?? summary.error ?? policy.error,
      { companyId }
    );

    return {
      files: [],
      summary: EMPTY_SUMMARY,
      policy: EMPTY_POLICY,
      isDegraded: true,
    };
  }

  const summaryRow = isJsonObject(summary.data) ? summary.data : {};
  const policyRow = isJsonObject(policy.data) ? policy.data : {};
  const allowed = policyRow['allowed_mime_types'];

  return {
    files: asRows(files.data).map((row) => ({
      fileId: readString(row, 'file_id') ?? '',
      fileName: readString(row, 'file_name') ?? '',
      mimeType: readString(row, 'mime_type') ?? 'application/octet-stream',
      byteSize: readNumber(row, 'byte_size') ?? 0,
      filePurpose: readString(row, 'file_purpose') ?? 'attachment',
      visibility: readString(row, 'visibility') ?? 'private',
      ownerType: readString(row, 'owner_type'),
      ownerId: readString(row, 'owner_id'),
      version: readNumber(row, 'version') ?? 1,
      isCurrent: readBoolean(row, 'is_current'),
      storageTier: readString(row, 'storage_tier') ?? 'hot',
      scanStatus: readString(row, 'scan_status') ?? 'pending',
      altText: readString(row, 'alt_text'),
      accessCount: readNumber(row, 'access_count') ?? 0,
      uploadedAt: readString(row, 'uploaded_at'),
      createdAt: readString(row, 'created_at') ?? '',
    })),
    summary: {
      quotaBytes: whole(summaryRow, 'quota_bytes'),
      usedBytes: whole(summaryRow, 'used_bytes'),
      fileCount: whole(summaryRow, 'file_count'),
      archivedCount: whole(summaryRow, 'archived_count'),
      orphanCount: whole(summaryRow, 'orphan_count'),
      openUploadCount: whole(summaryRow, 'open_upload_count'),
      usedPercentage: whole(summaryRow, 'used_percentage'),
    },
    policy: {
      provider: typeof policyRow['provider'] === 'string' ? policyRow['provider'] : 'local_disk',
      maxUploadBytes: whole(policyRow, 'max_upload_bytes'),
      allowedMimeTypes: Array.isArray(allowed)
        ? allowed.filter((entry): entry is string => typeof entry === 'string')
        : [],
      isConfigured: policyRow['is_configured'] === true,
    },
    isDegraded: false,
  };
}

/**
 * Reads the kinds of file a business is holding, for the filter list.
 *
 * @param files The files already read.
 * @returns Each kind once, in the order it first appears.
 */
export function purposesPresent(files: readonly StoredFile[]): readonly string[] {
  const seen: string[] = [];

  for (const file of files) {
    if (!seen.includes(file.filePurpose)) {
      seen.push(file.filePurpose);
    }
  }

  return seen;
}
