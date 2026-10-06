// src/features/integrations/actions/rotate-credential.ts
// Replacing a key without dropping the requests already in flight.
//
// The old secret stays valid for a few minutes after the new one is stored,
// because a provider call that left this server a second before the change
// still has to be able to finish. After that window the old key is useless.

'use server';

import { revalidatePath } from 'next/cache';

import { rotateIntegrationSchema } from '@/features/integrations/validation/integration';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireUser } from '@/lib/auth/guards';
import { encryptCredentialBundle } from '@/lib/crypto/encryption';
import { secretHint, sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { clearIntegrationCache } from '@/lib/integrations/resolve';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { JsonObject } from '@/types/json';

export interface RotateCredentialResult {
  /** True when the replacement is now in use. */
  isRotated: boolean;
  /** When the previous key stops working. */
  graceMinutes: number;
}

export const rotateIntegrationCredential = createAction(
  rotateIntegrationSchema,
  async (input): Promise<RotateCredentialResult> => {
    await requireUser();

    const bundle: Record<string, string> = {};
    const hints: JsonObject = {};

    for (const [key, value] of Object.entries(input.values)) {
      if (value === '') {
        continue;
      }

      bundle[key] = value;
      hints[key] = secretHint(value);
    }

    if (Object.keys(bundle).length === 0) {
      throw new AppError('validation_failed', 'Enter the replacement key before rotating.');
    }

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('rotate_integration_credential', {
      p_credential_id: input.credentialId,
      p_new_bundle_encrypted: encryptCredentialBundle(bundle),
      p_new_fingerprint: sha256Hex(JSON.stringify(bundle)),
      p_masked_hints: hints,
      p_grace_minutes: input.graceMinutes,
    });

    if (error) {
      logger.error('A credential could not be rotated', error, { provider: input.providerKey });

      throw new AppError('database_failure', 'That key could not be replaced. Try again.');
    }

    clearIntegrationCache();

    await recordAuditEntry({
      action: 'secret_change',
      entityType: 'integration_credential',
      entityId: input.credentialId,
      description: `Key replaced for ${input.providerKey}, with a ${String(input.graceMinutes)} minute grace window.`,
      metadata: { provider: input.providerKey, grace_minutes: input.graceMinutes },
    });

    revalidatePath('/admin/integrations');
    revalidatePath('/dashboard/settings/integrations');

    return { isRotated: true, graceMinutes: input.graceMinutes };
  },
  { name: 'rotateIntegrationCredential' }
);
