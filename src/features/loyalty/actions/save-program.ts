// src/features/loyalty/actions/save-program.ts
// Writing the loyalty scheme. Points are a promise to give money back, so
// only the account owner may set the rate at which they are given away.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveProgramSchema } from '@/features/loyalty/validation/loyalty';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveProgramResult {
  /** Identifier of the scheme that was saved. */
  programId: string;
}

export const saveLoyaltyProgram = createAction(
  saveProgramSchema,
  async (input): Promise<SaveProgramResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_loyalty_program', {
      p_company_id: company.id,
      p_name: input.name,
      p_program_id: input.programId ?? null,
      p_description: input.description ?? null,
      p_points_per_currency_unit: input.pointsPerCurrencyUnit,
      p_earn_on: input.earnOn,
      p_minimum_spend: input.minimumSpend,
      p_point_value: input.pointValue,
      p_minimum_redemption_points: input.minimumRedemptionPoints,
      p_redemption_multiple: input.redemptionMultiple,
      p_points_expire_after_months: input.pointsExpireAfterMonths ?? null,
      p_silver_threshold: input.silverThreshold ?? null,
      p_gold_threshold: input.goldThreshold ?? null,
      p_platinum_threshold: input.platinumThreshold ?? null,
      p_terms_url: input.termsUrl ?? null,
      p_currency: input.currency,
      p_is_active: input.isActive,
    });

    if (error || typeof data !== 'string') {
      logger.error('The loyalty scheme could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That scheme could not be saved. Try again.'
      );
    }

    await recordAuditEntry({
      action: input.programId === undefined ? 'insert' : 'update',
      entityType: 'loyalty_program',
      entityId: data,
      companyId: company.id,
      description:
        input.programId === undefined ? 'Started a loyalty scheme' : 'Changed the loyalty scheme',
    });

    revalidatePath(ROUTES.loyalty);

    return { programId: data };
  },
  { name: 'saveLoyaltyProgram' }
);
