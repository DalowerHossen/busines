// src/features/affiliates/actions/request-affiliate-payout.ts
// Turning an approved referral balance into money on its way out. The amount
// leaves the available balance at once, so the same money cannot be asked
// for twice.

'use server';

import { revalidatePath } from 'next/cache';

import { requestAffiliatePayoutSchema } from '@/features/affiliates/validation/affiliate';
import { createAction } from '@/lib/actions/create-action';
import { requireUser } from '@/lib/auth/guards';
import { ROUTES } from '@/config/app';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RequestAffiliatePayoutResult {
  /** Identifier of the payout that was requested. */
  payoutId: string;
}

export const requestAffiliatePayout = createAction(
  requestAffiliatePayoutSchema,
  async (input): Promise<RequestAffiliatePayoutResult> => {
    const user = await requireUser();

    const supabase = createServerSupabaseClient();

    const { data: affiliateData } = await supabase
      .from('affiliates')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    const affiliate = asRow(affiliateData);

    if (affiliate === null) {
      throw new AppError('forbidden', 'This account is not in the referral programme.');
    }

    const { data, error } = await supabase.rpc('request_affiliate_payout', {
      p_affiliate_id: readString(affiliate, 'id') ?? '',
      p_amount: input.amount,
      p_payout_account_id: input.payoutAccountId ?? null,
    });

    if (error) {
      logger.error('A referral payout could not be requested', error, { userId: user.id });

      throw new AppError(
        'validation_failed',
        'That payout was not requested. Check the amount against your available balance.'
      );
    }

    revalidatePath(ROUTES.affiliate);

    return { payoutId: typeof data === 'string' ? data : '' };
  },
  { name: 'requestAffiliatePayout' }
);
