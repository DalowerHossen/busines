// src/features/developers/actions/rotate-secret.ts
// Issuing a new client secret. The previous one keeps working for a short
// grace period so a running integration is not cut off mid request.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { appIdSchema } from '@/features/developers/validation/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RotateSecretResult {
  /** The new secret, shown once and never again. */
  clientSecret: string;
}

export const rotateAppSecret = createAction(
  appIdSchema,
  async (input): Promise<RotateSecretResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('rotate_app_secret', { p_app_id: input.appId });

    if (error || typeof data !== 'string' || data.length === 0) {
      logger.error('The application secret could not be rotated', error, { appId: input.appId });

      throw new AppError('database_failure', 'The secret could not be replaced. Please try again.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'developer_app',
      entityId: input.appId,
      companyId: company.id,
      description: 'Application secret rotated.',
    });

    revalidatePath(`${ROUTES.dashboard}/developers/${input.appId}`);

    return { clientSecret: data };
  },
  { name: 'rotateAppSecret' }
);
