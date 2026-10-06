// src/features/developers/actions/disconnect-app.ts
// Cutting an application off from an account. Every token it holds dies
// with the grant.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { disconnectAppSchema } from '@/features/developers/validation/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DisconnectAppResult {
  /** True when the grant was open and has now been closed. */
  wasConnected: boolean;
}

export const disconnectApp = createAction(
  disconnectAppSchema,
  async (input): Promise<DisconnectAppResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('revoke_app_install', {
      p_install_id: input.installId,
      p_reason: input.reason ?? 'Disconnected by the account owner',
    });

    if (error) {
      logger.error('The application could not be disconnected', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'The application could not be disconnected.');
    }

    await recordAuditEntry({
      action: 'permission_change',
      entityType: 'developer_app_install',
      entityId: input.installId,
      companyId: company.id,
      description: 'Application disconnected from this account.',
    });

    revalidatePath(`${ROUTES.settings}/connected-apps`);

    return { wasConnected: data === true };
  },
  { name: 'disconnectApp' }
);
