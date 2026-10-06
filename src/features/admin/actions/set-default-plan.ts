// src/features/admin/actions/set-default-plan.ts
// Choosing the plan every new business lands on at signup. The database
// stands the previous default down on its own, so there is never more than
// one.

'use server';

import { revalidatePath } from 'next/cache';

import { setDefaultPlanSchema } from '@/features/admin/validation/catalogue';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetDefaultPlanResult {
  /** Identifier of the plan new businesses now start on. */
  planId: string;
}

export const setDefaultPlan = createAction(
  setDefaultPlanSchema,
  async (input): Promise<SetDefaultPlanResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_default_on_signup: true })
      .eq('id', input.planId);

    if (error) {
      logger.error('The signup plan could not be changed', error, { planId: input.planId });

      throw new AppError(
        'database_failure',
        'The signup plan was not changed. An archived plan cannot be the default.'
      );
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'subscription_plan',
      entityId: input.planId,
      companyId: null,
      description: 'Plan set as the one new businesses start on.',
    });

    revalidatePath('/admin/plans');

    return { planId: input.planId };
  },
  { name: 'setDefaultPlan' }
);
