// src/features/onboarding/actions/dismiss-task.ts
// Hiding a setup suggestion a seller does not want.
//
// Only the optional ones can be hidden. The five steps that stand between
// signing up and being paid cannot be waved away, because hiding them would
// only mean the seller finds out later and at a worse moment.

'use server';

import { revalidatePath } from 'next/cache';

import { onboardingTaskSchema } from '@/features/onboarding/validation/onboarding';
import { createAction } from '@/lib/actions/create-action';
import { requireTenant, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** The steps nobody is allowed to hide. */
const REQUIRED_KEYS = [
  'business_details',
  'identity_check',
  'payout_destination',
  'first_client',
  'first_invoice',
];

export interface DismissTaskResult {
  /** True when the suggestion is now hidden. */
  isDismissed: boolean;
}

export const dismissOnboardingTask = createAction(
  onboardingTaskSchema,
  async (input): Promise<DismissTaskResult> => {
    const { company } = await requireTenant();
    requireWritableCompany(company);

    if (REQUIRED_KEYS.includes(input.taskKey)) {
      throw new AppError(
        'validation_failed',
        'This step is needed before you can be paid, so it cannot be hidden.'
      );
    }

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('dismiss_onboarding_task', {
      p_company_id: company.id,
      p_task_key: input.taskKey,
    });

    if (error) {
      logger.error('A setup suggestion could not be hidden', error, { companyId: company.id });

      throw new AppError('database_failure', 'That suggestion could not be hidden. Try again.');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/setup');

    return { isDismissed: true };
  },
  { name: 'dismissOnboardingTask' }
);
