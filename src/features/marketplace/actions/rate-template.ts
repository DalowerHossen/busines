// src/features/marketplace/actions/rate-template.ts
// A rating from somebody who actually installed the template. The database
// refuses anything else, which is what makes the ratings worth reading.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { rateTemplateSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RateTemplateResult {
  /** Identifier of the rating that was stored. */
  reviewId: string;
}

export const rateTemplate = createAction(
  rateTemplateSchema,
  async (input): Promise<RateTemplateResult> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('review_listing', {
      p_company_id: company.id,
      p_listing_id: input.listingId,
      p_rating: input.rating,
      p_title: input.title,
      p_body: input.body,
    });

    if (error) {
      logger.error('A marketplace rating could not be stored', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'marketplace_review',
      entityId: typeof data === 'string' ? data : '',
      companyId: company.id,
      description: `Rated a marketplace template ${input.rating} out of 5.`,
    });

    revalidatePath(ROUTES.marketplace);

    return { reviewId: typeof data === 'string' ? data : '' };
  },
  { name: 'rateTemplate' }
);
