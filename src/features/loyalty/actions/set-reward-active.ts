// src/features/loyalty/actions/set-reward-active.ts
// Withdrawing a reward, or offering it again, without losing the record of
// everybody who already claimed it.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { setRewardActiveSchema } from '@/features/loyalty/validation/loyalty';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetRewardActiveResult {
  /** True when the change was stored. */
  wasChanged: boolean;
}

export const setLoyaltyRewardActive = createAction(
  setRewardActiveSchema,
  async (input): Promise<SetRewardActiveResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('set_loyalty_reward_active', {
      p_reward_id: input.rewardId,
      p_is_active: input.isActive,
    });

    if (error) {
      logger.error('A loyalty reward could not be switched', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'loyalty_reward',
      entityId: input.rewardId,
      companyId: company.id,
      description: input.isActive ? 'Offered a reward again' : 'Withdrew a reward',
    });

    revalidatePath(ROUTES.loyalty);

    return { wasChanged: data === true };
  },
  { name: 'setLoyaltyRewardActive' }
);
