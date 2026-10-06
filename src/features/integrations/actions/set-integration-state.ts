// src/features/integrations/actions/set-integration-state.ts
// Switching one connection on or off without losing what was configured.

'use server';

import { revalidatePath } from 'next/cache';

import { credentialActionSchema } from '@/features/integrations/validation/integration';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireUser } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { clearIntegrationCache } from '@/lib/integrations/resolve';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetIntegrationStateResult {
  /** True when the connection is now on. */
  isEnabled: boolean;
}

export const enableIntegration = createAction(
  credentialActionSchema,
  async (input): Promise<SetIntegrationStateResult> => {
    await requireUser();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('enable_integration', {
      p_credential_id: input.credentialId,
    });

    if (error) {
      logger.error('A connection could not be switched on', error);

      throw new AppError(
        'database_failure',
        'That connection could not be switched on. Test it first; a connection that has never answered cannot be enabled.'
      );
    }

    clearIntegrationCache();

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'integration_credential',
      entityId: input.credentialId,
      description: 'Connection switched on.',
    });

    revalidatePath('/admin/integrations');
    revalidatePath('/dashboard/settings/integrations');

    return { isEnabled: data === true };
  },
  { name: 'enableIntegration' }
);

export const disableIntegration = createAction(
  credentialActionSchema,
  async (input): Promise<SetIntegrationStateResult> => {
    await requireUser();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('disable_integration', {
      p_credential_id: input.credentialId,
      p_reason: input.reason ?? 'Switched off from the admin panel.',
    });

    if (error) {
      logger.error('A connection could not be switched off', error);

      throw new AppError('database_failure', 'That connection could not be switched off.');
    }

    clearIntegrationCache();

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'integration_credential',
      entityId: input.credentialId,
      description: 'Connection switched off.',
    });

    revalidatePath('/admin/integrations');
    revalidatePath('/dashboard/settings/integrations');

    return { isEnabled: false };
  },
  { name: 'disableIntegration' }
);
