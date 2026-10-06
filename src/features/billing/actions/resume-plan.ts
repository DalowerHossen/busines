// src/features/billing/actions/resume-plan.ts
// Taking back a cancellation, or waking a plan that was paused while a
// platform invoice went unpaid.

'use server';

import { revalidatePath } from 'next/cache';

import { resumePlanSchema } from '@/features/billing/validation/billing';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ResumePlanResult {
  /** The state the subscription is in after being restarted. */
  status: string;
}

export const resumePlan = createAction(
  resumePlanSchema,
  async (input): Promise<ResumePlanResult> => {
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
      throw new AppError(
        'not_found',
        'This plan has already ended. Choose a plan below to start again.'
      );
    }

    const { data, error } = await supabase.rpc('resume_subscription', {
      p_subscription_id: readString(subscription, 'id'),
      p_reason: input.reason,
    });

    if (error) {
      logger.error('The plan could not be restarted', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The plan could not be restarted. It may already be running.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'subscription',
      entityId: readString(subscription, 'id'),
      companyId: company.id,
      description: 'Plan restarted from the billing page.',
    });

    revalidatePath('/dashboard/billing');

    return { status: typeof data === 'string' ? data : 'active' };
  },
  { name: 'resumePlan' }
);
