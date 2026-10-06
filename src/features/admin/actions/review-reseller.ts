// src/features/admin/actions/review-reseller.ts
// The platform team's decision on a white label application, including the
// terms the partner will work under.

'use server';

import { revalidatePath } from 'next/cache';

import { reviewResellerSchema } from '@/features/resellers/validation/reseller';
import { createAction } from '@/lib/actions/create-action';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewResellerResult {
  /** The state the partner is in afterwards. */
  status: string;
}

export const reviewReseller = createAction(
  reviewResellerSchema,
  async (input): Promise<ReviewResellerResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('review_reseller_application', {
      p_reseller_id: input.resellerId,
      p_approve: input.isApproved,
      p_note: input.note,
      p_revenue_share: input.revenueShare ?? null,
      p_max_sub_tenants: input.maxSubTenants ?? null,
    });

    if (error) {
      logger.error('A partner application could not be decided', error, {
        resellerId: input.resellerId,
      });

      throw new AppError(
        'database_failure',
        'That application was not changed. Somebody may have decided it already.'
      );
    }

    revalidatePath('/admin/partners');

    return { status: typeof data === 'string' ? data : 'pending_review' };
  },
  { name: 'reviewReseller' }
);
