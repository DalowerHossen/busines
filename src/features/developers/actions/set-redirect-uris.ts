// src/features/developers/actions/set-redirect-uris.ts
// The exact addresses an authorisation may be returned to. There are no
// wildcards, because a wildcard is how an authorisation gets stolen.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { setRedirectUrisSchema } from '@/features/developers/validation/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetRedirectUrisResult {
  /** How many addresses the application now has. */
  addressCount: number;
}

export const setAppRedirectUris = createAction(
  setRedirectUrisSchema,
  async (input): Promise<SetRedirectUrisResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('set_app_redirect_uris', {
      p_app_id: input.appId,
      p_redirect_uris: input.redirectUris,
    });

    if (error) {
      logger.error('The return addresses could not be saved', error, { appId: input.appId });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'developer_app',
      entityId: input.appId,
      companyId: company.id,
      description: 'Return addresses updated.',
      metadata: { addresses: [...input.redirectUris] },
    });

    revalidatePath(`${ROUTES.dashboard}/developers/${input.appId}`);

    return { addressCount: typeof data === 'number' ? data : input.redirectUris.length };
  },
  { name: 'setAppRedirectUris' }
);
