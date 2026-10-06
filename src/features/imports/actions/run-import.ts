// src/features/imports/actions/run-import.ts
// Bringing a spreadsheet of clients or products into the business.
//
// Always rehearsed first. The person sees exactly what would be created,
// what already exists, and which rows cannot be used, and only then decides
// whether to run it for real.

'use server';

import { revalidatePath } from 'next/cache';

import { runImportSchema } from '@/features/imports/validation/import';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { parseDelimitedText } from '@/lib/imports/csv';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type Json } from '@/types/json';

/** Where the import screen lives, for cache invalidation. */
const IMPORT_PATH = '/dashboard/settings/import';

export interface ImportProblem {
  row: number;
  problem: string;
}

export interface RunImportResult {
  /** True when nothing was written. */
  isDryRun: boolean;
  rowCount: number;
  createdCount: number;
  matchedCount: number;
  skippedCount: number;
  problems: readonly ImportProblem[];
  /** The column names the file actually had. */
  headers: readonly string[];
  /** Anything wrong with the file itself. */
  fileProblem: string | null;
}

export const runDataImport = createAction(
  runImportSchema,
  async (input): Promise<RunImportResult> => {
    const { company } = await requirePermission(
      input.importKind === 'clients' ? 'clients' : 'products',
      'create'
    );
    requireWritableCompany(company);

    const table = parseDelimitedText(input.fileText);

    if (table.rows.length === 0) {
      throw new AppError(
        'validation_failed',
        table.problem ?? 'That file has a header but no rows under it.'
      );
    }

    const rows: Json = table.rows.map((row) => ({ ...row }));

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc(
      input.importKind === 'clients' ? 'import_client_rows' : 'import_product_rows',
      {
        p_company_id: company.id,
        p_rows: rows,
        p_is_dry_run: input.isDryRun,
        p_source_label: input.sourceLabel ?? null,
      }
    );

    if (error || !isJsonObject(data)) {
      logger.error('An import could not be run', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That file could not be brought in. Check the column names and try again.'
      );
    }

    /**
     * Reads a counter out of the result.
     *
     * @param key Field being read.
     * @returns The count, or zero.
     */
    function count(key: string): number {
      const value = isJsonObject(data) ? data[key] : null;

      return typeof value === 'number' ? value : Number(value ?? 0) || 0;
    }

    const rawProblems =
      isJsonObject(data) && Array.isArray(data['problems']) ? data['problems'] : [];

    if (!input.isDryRun) {
      await recordAuditEntry({
        action: 'insert',
        entityType: 'data_import',
        entityId: typeof data['batch_id'] === 'string' ? data['batch_id'] : null,
        companyId: company.id,
        description: `Imported ${String(count('created_count'))} ${input.importKind} from a file.`,
        metadata: { import_kind: input.importKind, row_count: count('row_count') },
      });
    }

    revalidatePath(IMPORT_PATH);
    revalidatePath(input.importKind === 'clients' ? '/dashboard/clients' : '/dashboard/products');

    return {
      isDryRun: input.isDryRun,
      rowCount: count('row_count'),
      createdCount: count('created_count'),
      matchedCount: count('matched_count'),
      skippedCount: count('skipped_count'),
      problems: rawProblems.flatMap((entry) => {
        if (!isJsonObject(entry)) {
          return [];
        }

        return [
          {
            row: typeof entry['row'] === 'number' ? entry['row'] : 0,
            problem: typeof entry['problem'] === 'string' ? entry['problem'] : '',
          },
        ];
      }),
      headers: table.headers,
      fileProblem: table.problem,
    };
  },
  { name: 'runDataImport' }
);
