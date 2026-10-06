// src/features/affiliates/actions/save-affiliate-link.ts
// Named referral links, so a partner can tell one campaign from another
// without us ever telling them who signed up.

'use server';

import { revalidatePath } from 'next/cache';

import { saveAffiliateLinkSchema } from '@/features/affiliates/validation/affiliate';
import { createAction } from '@/lib/actions/create-action';
import { requireUser } from '@/lib/auth/guards';
import { ROUTES } from '@/config/app';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveAffiliateLinkResult {
  /** Identifier of the link that was written. */
  linkId: string;
}

export const saveAffiliateLink = createAction(
  saveAffiliateLinkSchema,
  async (input): Promise<SaveAffiliateLinkResult> => {
    const user = await requireUser();

    const supabase = createServerSupabaseClient();

    const { data: affiliateData } = await supabase
      .from('affiliates')
      .select('id, status')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    const affiliate = asRow(affiliateData);

    if (affiliate === null) {
      throw new AppError('forbidden', 'This account is not in the referral programme.');
    }

    if (readString(affiliate, 'status') !== 'approved') {
      throw new AppError('forbidden', 'Links can be created once your application is approved.');
    }

    const affiliateId = readString(affiliate, 'id') ?? '';

    const payload = {
      affiliate_id: affiliateId,
      slug: input.slug,
      label: input.label,
      destination_path: input.destinationPath,
      campaign: input.campaign,
      is_active: input.isActive,
      updated_by: user.id,
    };

    if (input.linkId) {
      const { error } = await supabase
        .from('affiliate_links')
        .update(payload)
        .eq('id', input.linkId)
        .eq('affiliate_id', affiliateId)
        .is('deleted_at', null);

      if (error) {
        logger.error('A referral link could not be changed', error, { linkId: input.linkId });

        throw new AppError('conflict', 'That link was not saved. The name may already be in use.');
      }

      revalidatePath(ROUTES.affiliate);

      return { linkId: input.linkId };
    }

    const { data, error } = await supabase
      .from('affiliate_links')
      .insert({ ...payload, created_by: user.id })
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('A referral link could not be created', error, { affiliateId });

      throw new AppError('conflict', 'That link was not saved. The name may already be in use.');
    }

    const row = asRow(data);

    revalidatePath(ROUTES.affiliate);

    return { linkId: row === null ? '' : (readString(row, 'id') ?? '') };
  },
  { name: 'saveAffiliateLink' }
);
