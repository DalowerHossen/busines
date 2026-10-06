// src/features/storefronts/actions/set-status.ts
// Taking a shop live, or stopping it. Going live is refused until the
// business behind the shop has been verified by the platform team.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { setStatusSchema } from '@/features/storefronts/validation/storefronts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetStatusResult {
  /** True when the change was stored. */
  wasChanged: boolean;
}

export const setStorefrontStatus = createAction(
  setStatusSchema,
  async (input): Promise<SetStatusResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('set_storefront_status', {
      p_connection_id: input.connectionId,
      p_status: input.status,
      p_reason: input.reason ?? null,
    });

    if (error) {
      logger.error('A shop connection could not be changed', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'storefront_connection',
      entityId: input.connectionId,
      companyId: company.id,
      description: input.status === 'active' ? 'Took a shop live' : 'Stopped a shop',
      metadata: { status: input.status, reason: input.reason ?? null },
    });

    revalidatePath(`${ROUTES.settings}/storefronts`);

    return { wasChanged: data === true };
  },
  { name: 'setStorefrontStatus' }
);
