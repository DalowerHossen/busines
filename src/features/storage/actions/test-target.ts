// src/features/storage/actions/test-target.ts
// Checking a file store answers before anybody trusts it with a document.
//
// The credentials are decrypted for this call only and the result is written
// against the store, so the console shows when it was last known to work
// rather than when somebody last remembered to look.

'use server';

import { revalidatePath } from 'next/cache';

import { targetIdSchema } from '@/features/storage/validation/storage';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readBoolean, readNumber, readString } from '@/lib/records';
import { storageAdapterFor, storageTargetFrom } from '@/lib/storage/resolve-target';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface TestTargetResult {
  /** True when the store answered as expected. */
  isHealthy: boolean;
  /** A sentence the platform team can act on. */
  message: string;
}

export const testStorageTarget = createAction(
  targetIdSchema,
  async (input): Promise<TestTargetResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('storage_targets')
      .select(
        'id, provider, bucket_name, region, endpoint_url, public_base_url, force_path_style, signed_url_ttl_seconds, credentials_encrypted, previous_credentials_encrypted, previous_credentials_valid_until'
      )
      .eq('id', input.targetId)
      .is('deleted_at', null)
      .maybeSingle();

    const row = asRow(data);

    if (error || row === null) {
      throw new AppError('not_found', 'That store could not be found.');
    }

    const target = storageTargetFrom({
      target_id: readString(row, 'id'),
      provider: readString(row, 'provider'),
      bucket_name: readString(row, 'bucket_name'),
      region: readString(row, 'region'),
      endpoint_url: readString(row, 'endpoint_url'),
      public_base_url: readString(row, 'public_base_url'),
      force_path_style: readBoolean(row, 'force_path_style'),
      signed_url_ttl_seconds: readNumber(row, 'signed_url_ttl_seconds'),
      credentials_encrypted: readString(row, 'credentials_encrypted'),
      previous_credentials_encrypted: readString(row, 'previous_credentials_encrypted'),
      previous_credentials_valid_until: readString(row, 'previous_credentials_valid_until'),
    });

    let outcome: TestTargetResult;

    try {
      outcome = await storageAdapterFor(target.provider).checkHealth(target);
    } catch (cause) {
      logger.error('A file store could not be tested', cause, { targetId: input.targetId });

      outcome = { isHealthy: false, message: 'The store could not be reached from this server.' };
    }

    await supabase.rpc('record_storage_target_health', {
      p_target_id: input.targetId,
      p_succeeded: outcome.isHealthy,
      p_message: outcome.message,
    });

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'storage_target',
      entityId: input.targetId,
      description: `File store tested: ${outcome.isHealthy ? 'healthy' : 'not working'}.`,
    });

    revalidatePath('/admin/storage');

    return outcome;
  },
  { name: 'testStorageTarget' }
);
