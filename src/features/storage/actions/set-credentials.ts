// src/features/storage/actions/set-credentials.ts
// Putting new keys on a file store without taking the platform down.
//
// The keys are encrypted before they leave this function and the pair being
// replaced keeps working for five minutes, so an upload already in flight is
// never dropped by a rotation.

'use server';

import { revalidatePath } from 'next/cache';

import { setCredentialsSchema } from '@/features/storage/validation/storage';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { encryptCredentialBundle } from '@/lib/crypto/encryption';
import { sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetCredentialsResult {
  /** Last four characters of the key, kept so it can be recognised. */
  maskedHint: string;
}

export const setStorageCredentials = createAction(
  setCredentialsSchema,
  async (input): Promise<SetCredentialsResult> => {
    await requireSuperAdmin();

    const values: Record<string, string> = {};

    if (input.accessKeyId !== undefined) {
      values['access_key_id'] = input.accessKeyId;
    }

    if (input.secretAccessKey !== undefined) {
      values['secret_access_key'] = input.secretAccessKey;
    }

    if (input.serviceKey !== undefined) {
      values['service_key'] = input.serviceKey;
    }

    if (input.projectUrl !== undefined) {
      values['project_url'] = input.projectUrl;
    }

    if (Object.keys(values).length === 0) {
      throw new AppError('validation_failed', 'Nothing was given to store.');
    }

    const supabase = createServerSupabaseClient();
    const envelope = encryptCredentialBundle(values);
    const fingerprint = sha256Hex(Object.values(values).join(':'));

    const { error } = await supabase.rpc('set_storage_target_credentials', {
      p_target_id: input.targetId,
      p_credentials_encrypted: envelope,
      p_fingerprint: fingerprint,
      p_grace_minutes: 5,
    });

    if (error) {
      logger.error('The keys of a file store could not be saved', error);

      throw new AppError('database_failure', error.message);
    }

    const shown = input.secretAccessKey ?? input.serviceKey ?? input.accessKeyId ?? '';

    await recordAuditEntry({
      action: 'secret_change',
      entityType: 'storage_target',
      entityId: input.targetId,
      description: 'Replaced the keys of a file store',
      metadata: { fingerprint },
    });

    revalidatePath('/admin/storage');

    return { maskedHint: shown.slice(-4) };
  },
  { name: 'setStorageCredentials' }
);
