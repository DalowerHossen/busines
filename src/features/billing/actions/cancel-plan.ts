// src/features/billing/actions/cancel-plan.ts
// Stopping a paid plan. By default the plan keeps running until the paid
// period ends, because nobody should lose days they already paid for.

'use server';

import { revalidatePath } from 'next/cache';

import { cancelPlanSchema } from '@/features/billing/validation/billing';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CancelPlanResult {
  /** The state the subscription is in after the request. */
  status: string;
}

export const cancelPlan = createAction(
  cancelPlanSchema,
  async (input): Promise<CancelPlanResult> => {
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
      throw new AppError('not_found', 'There is no live plan to stop.');
    }

    const { data, error } = await supabase.rpc('cancel_subscription', {
      p_subscription_id: readString(subscription, 'id'),
      p_immediately: input.isImmediate,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('The plan could not be cancelled', error, { companyId: company.id });

      throw new AppError('database_failure', 'The plan could not be stopped. Please try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'subscription',
      entityId: readString(subscription, 'id'),
      companyId: company.id,
      description: input.isImmediate
        ? 'Plan stopped immediately from the billing page.'
        : 'Plan set to stop at the end of the paid period.',
      metadata: { reason: input.reason },
    });

    revalidatePath('/dashboard/billing');

    return { status: typeof data === 'string' ? data : 'active' };
  },
  { name: 'cancelPlan' }
);
