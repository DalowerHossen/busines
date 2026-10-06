// src/features/files/actions/delete-file.ts
// Taking a file out of the library.
//
// Documents that are part of a legal record refuse to go, which is decided
// in the database rather than here, so no screen can talk its way around it.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { deleteFileSchema } from '@/features/files/validation/files';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireTenant, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DeleteFileResult {
  /** Identifier of the file that was removed. */
  fileId: string;
}

export const deleteStoredFile = createAction(
  deleteFileSchema,
  async (input): Promise<DeleteFileResult> => {
    const { company } = await requireTenant();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('delete_file', {
      p_file_id: input.fileId,
      p_reason: input.reason ?? null,
    });

    if (error) {
      logger.error('A file could not be removed', error, { companyId: company.id });

      throw new AppError('validation_failed', error.message);
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'file',
      entityId: input.fileId,
      companyId: company.id,
      description: 'Removed a file from the library',
      metadata: { reason: input.reason ?? null },
    });

    revalidatePath(ROUTES.files);

    return { fileId: input.fileId };
  },
  { name: 'deleteStoredFile' }
);
