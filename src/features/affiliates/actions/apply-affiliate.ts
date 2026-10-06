// src/features/affiliates/actions/apply-affiliate.ts
// Joining the referral programme. Anybody with an account may apply; nothing
// earns until the platform team approves the application.

'use server';

import { revalidatePath } from 'next/cache';

import { applyAffiliateSchema } from '@/features/affiliates/validation/affiliate';
import { createAction } from '@/lib/actions/create-action';
import { requireUser } from '@/lib/auth/guards';
import { ROUTES } from '@/config/app';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ApplyAffiliateResult {
  /** Identifier of the application that was created. */
  affiliateId: string;
}

export const applyAffiliate = createAction(
  applyAffiliateSchema,
  async (input): Promise<ApplyAffiliateResult> => {
    await requireUser();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('apply_for_affiliate', {
      p_referral_code: input.referralCode,
      p_display_name: input.displayName,
      p_contact_email: input.contactEmail,
      p_promotion_method: input.promotionMethod,
      p_website: input.website,
      p_country_code: input.countryCode ?? null,
      p_agreement_version: 'affiliate-terms-v1',
    });

    if (error) {
      logger.error('A referral application could not be created', error, {});

      throw new AppError(
        'conflict',
        'That application was not accepted. The code may be taken, or this account may already be in the programme.'
      );
    }

    revalidatePath(ROUTES.affiliate);

    return { affiliateId: typeof data === 'string' ? data : '' };
  },
  { name: 'applyAffiliate' }
);
