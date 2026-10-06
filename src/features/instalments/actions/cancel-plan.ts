// src/features/instalments/actions/cancel-plan.ts
// Ending an arrangement early. Whatever is still scheduled is cancelled and
// the invoice goes back to being settled the usual way.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { cancelPlanSchema } from '@/features/instalments/validation/instalments';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CancelPlanResult {
  /** True when the arrangement was ended. */
  wasCancelled: boolean;
}

export const cancelInstalmentPlan = createAction(
  cancelPlanSchema,
  async (input): Promise<CancelPlanResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('cancel_instalment_plan', {
      p_plan_id: input.planId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('An instalment plan could not be ended', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'instalment_plan',
      entityId: input.planId,
      companyId: company.id,
      description: 'Ended an instalment arrangement',
      metadata: { reason: input.reason },
    });

    revalidatePath(`${ROUTES.payments}/instalments`);
    revalidatePath(`${ROUTES.payments}/instalments/${input.planId}`);

    return { wasCancelled: data === true };
  },
  { name: 'cancelInstalmentPlan' }
);
