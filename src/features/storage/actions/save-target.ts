// src/features/storage/actions/save-target.ts
// Pointing the platform at a place to keep files, or changing where that is.

'use server';

import { revalidatePath } from 'next/cache';

import { saveTargetSchema } from '@/features/storage/validation/storage';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveTargetResult {
  /** Identifier of the store that was saved. */
  targetId: string;
}

export const saveStorageTarget = createAction(
  saveTargetSchema,
  async (input): Promise<SaveTargetResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_storage_target', {
      p_name: input.name,
      p_provider: input.provider,
      p_bucket_name: input.bucketName,
      p_target_id: input.targetId ?? null,
      p_region: input.region ?? null,
      p_endpoint_url: input.endpointUrl ?? null,
      p_path_prefix: input.pathPrefix ?? null,
      p_public_base_url: input.publicBaseUrl ?? null,
      p_force_path_style: input.forcePathStyle,
      p_signed_url_ttl_seconds: input.signedUrlTtlSeconds,
      p_max_upload_bytes: input.maxUploadBytes,
      p_is_active: input.isActive,
      p_is_default: input.isDefault,
    });

    if (error || typeof data !== 'string') {
      logger.error('A file store could not be saved', error);

      throw new AppError('database_failure', error?.message ?? 'That store could not be saved.');
    }

    await recordAuditEntry({
      action: input.targetId === undefined ? 'insert' : 'settings_change',
      entityType: 'storage_target',
      entityId: data,
      description: input.targetId === undefined ? 'Added a file store' : 'Changed a file store',
      metadata: { provider: input.provider, bucket: input.bucketName },
    });

    revalidatePath('/admin/storage');

    return { targetId: data };
  },
  { name: 'saveStorageTarget' }
);
