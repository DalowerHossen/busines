// src/features/settlements/actions/save-policy.ts
// Changing what the platform charges and how long it holds.
//
// These are commercial decisions, so they are data rather than code: a new
// percentage, a shorter hold or a faster withdrawal promise takes effect on
// the next payment without anybody deploying anything.

'use server';

import { revalidatePath } from 'next/cache';

import { settlementPolicySchema } from '@/features/settlements/validation/settlement';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveSettlementPolicyResult {
  /** Identifier of the terms that were saved. */
  policyId: string;
}

export const saveSettlementPolicy = createAction(
  settlementPolicySchema,
  async (input): Promise<SaveSettlementPolicyResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_settlement_policy', {
      p_name: input.name,
      p_fee_percentage: input.feePercentage,
      p_minimum_fee: input.minimumFee,
      p_company_id: input.companyId,
      p_fixed_fee: input.fixedFee,
      p_hold_days: input.holdDays,
      p_payout_sla_hours: input.payoutSlaHours,
      p_payout_threshold: input.payoutThreshold,
      p_notes: input.notes ?? null,
    });

    if (error) {
      logger.error('The collection terms could not be saved', error, {
        companyId: input.companyId,
      });

      throw new AppError(
        'database_failure',
        'Those terms could not be saved. Check the figures and try again.'
      );
    }

    const policyId = typeof data === 'string' ? data : null;

    if (policyId === null) {
      throw new AppError('database_failure', 'The terms were saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'settlement_policy',
      entityId: policyId,
      companyId: input.companyId,
      description:
        input.companyId === null
          ? `Standard collection terms set to ${String(input.feePercentage)} percent with a ${String(input.holdDays)} day hold.`
          : `Negotiated terms set to ${String(input.feePercentage)} percent with a ${String(input.holdDays)} day hold.`,
      metadata: {
        fee_percentage: input.feePercentage,
        minimum_fee: input.minimumFee,
        hold_days: input.holdDays,
        payout_sla_hours: input.payoutSlaHours,
        payout_threshold: input.payoutThreshold,
      },
    });

    revalidatePath('/admin/settlements');

    return { policyId };
  },
  { name: 'saveSettlementPolicy' }
);
