// src/features/files/actions/complete-upload.ts
// Turning a finished upload into a file in the library.
//
// The browser tells us how many bytes it sent and the checksum of what it
// sent. The checksum is what makes the same document uploaded twice cost one
// object rather than two.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { completeUploadSchema } from '@/features/files/validation/files';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireTenant, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface CompleteUploadResult {
  /** Identifier of the file now in the library. */
  fileId: string;
}

export const completeFileUpload = createAction(
  completeUploadSchema,
  async (input): Promise<CompleteUploadResult> => {
    const { company } = await requireTenant();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('complete_upload_session', {
      p_session_id: input.sessionId,
      p_byte_size: input.byteSize,
      p_content_hash: input.contentHash ?? null,
    });

    if (error || typeof data !== 'string') {
      logger.error('An upload could not be finished', error, { companyId: company.id });

      throw new AppError(
        'validation_failed',
        error?.message ?? 'That upload could not be finished.'
      );
    }

    // A drive names the object itself, so what it called the file is kept
    // beside our own key or the bytes could never be found again.
    if (input.externalObjectId !== undefined && input.externalObjectId !== '') {
      const service = getServiceSupabaseClient();

      const { error: idError } = await service.rpc('set_file_external_id', {
        p_file_id: data,
        p_external_id: input.externalObjectId,
      });

      if (idError) {
        logger.error('The drive identifier of a file could not be stored', idError, {
          companyId: company.id,
        });
      }
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'file',
      entityId: data,
      companyId: company.id,
      description: 'Uploaded a file',
      metadata: { byteSize: input.byteSize },
    });

    revalidatePath(ROUTES.files);

    return { fileId: data };
  },
  { name: 'completeFileUpload' }
);
