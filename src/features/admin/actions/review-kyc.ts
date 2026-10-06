// src/features/admin/actions/review-kyc.ts
// Approving or refusing an identity check. Approval is what switches a
// business on as a merchant we collect for, so it is deliberately a single
// explicit decision with a note attached.

'use server';

import { revalidatePath } from 'next/cache';

import { reviewVerificationSchema } from '@/features/kyc/validation/kyc';
import { createAction } from '@/lib/actions/create-action';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewKycResult {
  /** The state the check is in afterwards. */
  status: string;
}

export const reviewKyc = createAction(
  reviewVerificationSchema,
  async (input): Promise<ReviewKycResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('review_kyc_verification', {
      p_verification_id: input.verificationId,
      p_approve: input.isApproved,
      p_note: input.note,
      p_valid_months: input.validMonths,
    });

    if (error) {
      logger.error('An identity check could not be reviewed', error, {
        verificationId: input.verificationId,
      });

      throw new AppError(
        'database_failure',
        'That check was not changed. Somebody may have decided it already.'
      );
    }

    revalidatePath('/admin/verification');

    return { status: typeof data === 'string' ? data : 'under_review' };
  },
  { name: 'reviewKyc' }
);
