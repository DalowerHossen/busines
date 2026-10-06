// src/features/admin/actions/review-affiliate.ts
// The platform team's decision on a referral application, and on a partner
// that has to be stopped.

'use server';

import { revalidatePath } from 'next/cache';

import { reviewAffiliateSchema } from '@/features/affiliates/validation/affiliate';
import { createAction } from '@/lib/actions/create-action';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewAffiliateResult {
  /** The state the partner is in afterwards. */
  status: string;
}

export const reviewAffiliate = createAction(
  reviewAffiliateSchema,
  async (input): Promise<ReviewAffiliateResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('review_affiliate_application', {
      p_affiliate_id: input.affiliateId,
      p_approve: input.isApproved,
      p_note: input.note,
    });

    if (error) {
      logger.error('A referral application could not be decided', error, {
        affiliateId: input.affiliateId,
      });

      throw new AppError(
        'database_failure',
        'That application was not changed. Somebody may have decided it already.'
      );
    }

    revalidatePath('/admin/affiliates');

    return { status: typeof data === 'string' ? data : 'pending_review' };
  },
  { name: 'reviewAffiliate' }
);
