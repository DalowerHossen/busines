// src/features/files/actions/rename-file.ts
// Renaming a file and saying what it shows, so the library stays readable.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { renameFileSchema } from '@/features/files/validation/files';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireTenant, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RenameFileResult {
  /** Identifier of the file that was renamed. */
  fileId: string;
}

export const renameStoredFile = createAction(
  renameFileSchema,
  async (input): Promise<RenameFileResult> => {
    const { company } = await requireTenant();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('rename_file', {
      p_file_id: input.fileId,
      p_file_name: input.fileName,
      p_alt_text: input.altText ?? null,
    });

    if (error) {
      logger.error('A file could not be renamed', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'file',
      entityId: input.fileId,
      companyId: company.id,
      description: 'Renamed a file',
      metadata: { fileName: input.fileName },
    });

    revalidatePath(ROUTES.files);

    return { fileId: input.fileId };
  },
  { name: 'renameStoredFile' }
);
