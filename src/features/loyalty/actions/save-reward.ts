// src/features/loyalty/actions/save-reward.ts
// Deciding what points buy. The cost in points and the value in money are
// both held here, so the scheme can always be priced.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveRewardSchema } from '@/features/loyalty/validation/loyalty';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveRewardResult {
  /** Identifier of the reward that was saved. */
  rewardId: string;
}

export const saveLoyaltyReward = createAction(
  saveRewardSchema,
  async (input): Promise<SaveRewardResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    if (input.rewardType === 'invoice_credit' && input.creditAmount === undefined) {
      throw new AppError('validation_failed', 'Say how much credit the reward is worth.', {
        fieldErrors: { creditAmount: ['Say how much credit the reward is worth.'] },
      });
    }

    if (input.rewardType === 'percentage_discount' && input.discountPercentage === undefined) {
      throw new AppError('validation_failed', 'Say how large the discount is.', {
        fieldErrors: { discountPercentage: ['Say how large the discount is.'] },
      });
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_loyalty_reward', {
      p_program_id: input.programId,
      p_name: input.name,
      p_points_cost: input.pointsCost,
      p_reward_id: input.rewardId ?? null,
      p_description: input.description ?? null,
      p_reward_type: input.rewardType,
      p_credit_amount: input.creditAmount ?? null,
      p_discount_percentage: input.discountPercentage ?? null,
      p_minimum_tier: input.minimumTier,
      p_stock_quantity: input.stockQuantity ?? null,
      p_per_member_limit: input.perMemberLimit ?? null,
      p_available_from: input.availableFrom ?? null,
      p_available_until: input.availableUntil ?? null,
      p_display_order: input.displayOrder,
    });

    if (error || typeof data !== 'string') {
      logger.error('A loyalty reward could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That reward could not be saved. Try again.'
      );
    }

    await recordAuditEntry({
      action: input.rewardId === undefined ? 'insert' : 'update',
      entityType: 'loyalty_reward',
      entityId: data,
      companyId: company.id,
      description: input.rewardId === undefined ? 'Added a reward' : 'Changed a reward',
    });

    revalidatePath(ROUTES.loyalty);

    return { rewardId: data };
  },
  { name: 'saveLoyaltyReward' }
);
