// src/features/resellers/actions/update-reseller-brand.ts
// How a partner looks to the businesses it sells to. The commercial terms
// are not writable here; the database grants see to that.

'use server';

import { revalidatePath } from 'next/cache';

import { updateResellerBrandSchema } from '@/features/resellers/validation/reseller';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireUser } from '@/lib/auth/guards';
import { ROUTES } from '@/config/app';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateResellerBrandResult {
  /** True once the presentation is stored. */
  isSaved: boolean;
}

export const updateResellerBrand = createAction(
  updateResellerBrandSchema,
  async (input): Promise<UpdateResellerBrandResult> => {
    const user = await requireUser();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('resellers')
      .update({
        partner_name: input.partnerName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        brand_name: input.brandName,
        brand_logo_url: input.brandLogoUrl,
        brand_primary_color: input.brandPrimaryColor,
        brand_accent_color: input.brandAccentColor,
        custom_domain: input.customDomain,
        hide_platform_branding: input.hidePlatformBranding,
        updated_by: user.id,
      })
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A partner brand could not be saved', error, { userId: user.id });

      throw new AppError(
        'conflict',
        'Those settings were not saved. The domain may already be in use by another partner.'
      );
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'reseller',
      entityId: user.id,
      description: 'White label partner updated their brand settings.',
    });

    revalidatePath(ROUTES.reseller);

    return { isSaved: true };
  },
  { name: 'updateResellerBrand' }
);
