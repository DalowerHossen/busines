// src/features/instalments/actions/set-offer-active.ts
// Turning one set of terms on or off. Plans already running are untouched;
// only new agreements are affected.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { setOfferActiveSchema } from '@/features/instalments/validation/instalments';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetOfferActiveResult {
  /** True when the change was stored. */
  wasChanged: boolean;
}

export const setInstalmentOfferActive = createAction(
  setOfferActiveSchema,
  async (input): Promise<SetOfferActiveResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('set_instalment_offer_active', {
      p_offer_id: input.offerId,
      p_is_active: input.isActive,
    });

    if (error) {
      logger.error('Instalment terms could not be switched', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'instalment_offer',
      entityId: input.offerId,
      companyId: company.id,
      description: input.isActive
        ? 'Switched instalment terms back on'
        : 'Switched instalment terms off',
    });

    revalidatePath(`${ROUTES.payments}/instalments/terms`);

    return { wasChanged: data === true };
  },
  { name: 'setInstalmentOfferActive' }
);
