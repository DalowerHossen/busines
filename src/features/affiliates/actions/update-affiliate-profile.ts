// src/features/affiliates/actions/update-affiliate-profile.ts
// A partner keeps its own contact details current. The commercial terms are
// not writable here; the database grants see to that.

'use server';

import { revalidatePath } from 'next/cache';

import { updateAffiliateProfileSchema } from '@/features/affiliates/validation/affiliate';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireUser } from '@/lib/auth/guards';
import { ROUTES } from '@/config/app';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateAffiliateProfileResult {
  /** True once the details are stored. */
  isSaved: boolean;
}

export const updateAffiliateProfile = createAction(
  updateAffiliateProfileSchema,
  async (input): Promise<UpdateAffiliateProfileResult> => {
    const user = await requireUser();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('affiliates')
      .update({
        display_name: input.displayName,
        contact_email: input.contactEmail,
        promotion_method: input.promotionMethod,
        website: input.website,
        country_code: input.countryCode ?? null,
        updated_by: user.id,
      })
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A referral profile could not be saved', error, { userId: user.id });

      throw new AppError('database_failure', 'Those details were not saved. Please try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'affiliate',
      entityId: user.id,
      description: 'Referral partner updated their contact details.',
    });

    revalidatePath(ROUTES.affiliate);

    return { isSaved: true };
  },
  { name: 'updateAffiliateProfile' }
);
