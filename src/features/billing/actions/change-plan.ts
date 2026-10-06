// src/features/billing/actions/change-plan.ts
// Moving a business to another plan. The database routine prices the unused
// part of the current period, so nobody pays twice for the same days.

'use server';

import { revalidatePath } from 'next/cache';

import { changePlanSchema } from '@/features/billing/validation/billing';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ChangePlanResult {
  /** The difference charged or credited for the rest of the period. */
  prorationAmount: string;
}

export const changePlan = createAction(
  changePlanSchema,
  async (input): Promise<ChangePlanResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .not('status', 'in', '(cancelled,expired)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const subscription = asRow(subscriptionData);

    if (subscription === null) {
      throw new AppError('not_found', 'This business has no live plan to change.');
    }

    const { data, error } = await supabase.rpc('change_subscription_plan', {
      p_subscription_id: readString(subscription, 'id'),
      p_plan_id: input.planId,
      p_billing_interval: input.interval,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('The plan could not be changed', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The plan could not be changed. Check that the plan is sold in your currency.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'subscription',
      entityId: readString(subscription, 'id'),
      companyId: company.id,
      description: 'Plan changed from the billing page.',
      metadata: { planId: input.planId, interval: input.interval },
    });

    revalidatePath('/dashboard/billing');

    return { prorationAmount: typeof data === 'number' ? String(data) : String(data ?? '0') };
  },
  { name: 'changePlan' }
);
