// src/features/loyalty/actions/save-testimonial.ts
// Keeping a client quote. Consent and publication travel together: take the
// consent away and the quote comes off the site in the same movement.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveTestimonialSchema } from '@/features/loyalty/validation/loyalty';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveTestimonialResult {
  /** Identifier of the quote that was saved. */
  testimonialId: string;
}

export const saveTestimonial = createAction(
  saveTestimonialSchema,
  async (input): Promise<SaveTestimonialResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_testimonial', {
      p_company_id: company.id,
      p_author_name: input.authorName,
      p_quote: input.quote,
      p_testimonial_id: input.testimonialId ?? null,
      p_review_request_id: input.reviewRequestId ?? null,
      p_author_title: input.authorTitle ?? null,
      p_author_company: input.authorCompany ?? null,
      p_rating: input.rating ?? null,
      p_consent_given: input.consentGiven,
      p_display_surface: input.displaySurface,
      p_is_featured: input.isFeatured,
      p_display_order: input.displayOrder,
    });

    if (error || typeof data !== 'string') {
      logger.error('A client quote could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That quote could not be saved. Try again.'
      );
    }

    await recordAuditEntry({
      action: input.testimonialId === undefined ? 'insert' : 'update',
      entityType: 'testimonial',
      entityId: data,
      companyId: company.id,
      description: input.testimonialId === undefined ? 'Kept a client quote' : 'Changed a quote',
      metadata: { consentGiven: input.consentGiven },
    });

    revalidatePath(`${ROUTES.loyalty}/reviews`);

    return { testimonialId: data };
  },
  { name: 'saveTestimonial' }
);
