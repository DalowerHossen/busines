// src/features/instalments/actions/decide-plan.ts
// Approving or refusing a plan that was asked for. Terms can be set to need
// a decision, and this is where it is made and written down.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { decidePlanSchema } from '@/features/instalments/validation/instalments';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DecidePlanResult {
  /** True when the decision was stored. */
  wasDecided: boolean;
}

export const decideInstalmentPlan = createAction(
  decidePlanSchema,
  async (input): Promise<DecidePlanResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    if (!input.isApproved && (input.reason === undefined || input.reason.length < 3)) {
      throw new AppError('validation_failed', 'Say why the plan is being refused.');
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('decide_instalment_plan', {
      p_plan_id: input.planId,
      p_approved: input.isApproved,
      p_reason: input.reason ?? null,
    });

    if (error) {
      logger.error('An instalment plan could not be decided', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: input.isApproved ? 'approve' : 'update',
      entityType: 'instalment_plan',
      entityId: input.planId,
      companyId: company.id,
      description: input.isApproved ? 'Approved an instalment plan' : 'Refused an instalment plan',
      metadata: { reason: input.reason ?? null },
    });

    revalidatePath(`${ROUTES.payments}/instalments`);
    revalidatePath(`${ROUTES.payments}/instalments/${input.planId}`);

    return { wasDecided: data === true };
  },
  { name: 'decideInstalmentPlan' }
);
