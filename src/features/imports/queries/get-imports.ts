// src/features/imports/queries/get-imports.ts
// Reading what a business has brought in before.

import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ImportRun {
  batchId: string;
  importKind: string;
  sourceLabel: string | null;
  isDryRun: boolean;
  rowCount: number;
  createdCount: number;
  matchedCount: number;
  skippedCount: number;
  startedAt: string;
}

export interface ImportHistory {
  runs: readonly ImportRun[];
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Reads the import history of one business.
 *
 * @param companyId Business being read.
 * @returns Every run, rehearsals included.
 */
export async function loadImportHistory(companyId: string): Promise<ImportHistory> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('import_history', {
    p_company_id: companyId,
    p_limit: 20,
  });

  if (error) {
    logger.error('The import history could not be read', error, { companyId });

    return { runs: [], isDegraded: true };
  }

  return {
    runs: asRows(data).map((row) => ({
      batchId: readString(row, 'batch_id') ?? '',
      importKind: readString(row, 'import_kind') ?? 'clients',
      sourceLabel: readString(row, 'source_label'),
      isDryRun: readBoolean(row, 'is_dry_run'),
      rowCount: readNumber(row, 'row_count') ?? 0,
      createdCount: readNumber(row, 'created_count') ?? 0,
      matchedCount: readNumber(row, 'matched_count') ?? 0,
      skippedCount: readNumber(row, 'skipped_count') ?? 0,
      startedAt: readString(row, 'started_at') ?? '',
    })),
    isDegraded: false,
  };
}
