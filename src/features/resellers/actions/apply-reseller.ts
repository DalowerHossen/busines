// src/features/resellers/actions/apply-reseller.ts
// Applying to sell the platform under your own brand.

'use server';

import { revalidatePath } from 'next/cache';

import { applyResellerSchema } from '@/features/resellers/validation/reseller';
import { createAction } from '@/lib/actions/create-action';
import { requireUser } from '@/lib/auth/guards';
import { ROUTES } from '@/config/app';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ApplyResellerResult {
  /** Identifier of the application that was created. */
  resellerId: string;
}

export const applyReseller = createAction(
  applyResellerSchema,
  async (input): Promise<ApplyResellerResult> => {
    await requireUser();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('apply_for_reseller', {
      p_partner_name: input.partnerName,
      p_slug: input.slug,
      p_contact_email: input.contactEmail,
      p_country_code: input.countryCode,
      p_brand_name: input.brandName,
      p_contact_phone: input.contactPhone,
      p_agreement_version: 'partner-agreement-v1',
    });

    if (error) {
      logger.error('A partner application could not be created', error, {});

      throw new AppError(
        'conflict',
        'That application was not accepted. The address may be taken, or this account may already be a partner.'
      );
    }

    revalidatePath(ROUTES.reseller);

    return { resellerId: typeof data === 'string' ? data : '' };
  },
  { name: 'applyReseller' }
);
