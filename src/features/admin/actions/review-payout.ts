// src/features/admin/actions/review-payout.ts
// Releasing a payout to the provider, or refusing it and handing the money
// straight back to the business.

'use server';

import { revalidatePath } from 'next/cache';

import { reviewPayoutSchema } from '@/features/admin/validation/payout-review';
import { createAction } from '@/lib/actions/create-action';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewPayoutResult {
  /** The state the payout is in afterwards. */
  status: string;
}

export const reviewPayout = createAction(
  reviewPayoutSchema,
  async (input): Promise<ReviewPayoutResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('review_payout', {
      p_payout_id: input.payoutId,
      p_approve: input.isApproved,
      p_note: input.note,
    });

    if (error) {
      logger.error('A payout could not be reviewed', error, { payoutId: input.payoutId });

      throw new AppError(
        'database_failure',
        'That payout was not changed. Somebody may have dealt with it already.'
      );
    }

    revalidatePath('/admin/money');

    return { status: typeof data === 'string' ? data : 'requested' };
  },
  { name: 'reviewPayout' }
);
