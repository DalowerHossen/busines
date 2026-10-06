// src/features/loyalty/actions/approve-testimonial.ts
// Publishing a quote. The database refuses unless the person who said it has
// agreed to it being shown, so this only ever confirms a decision.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { approveTestimonialSchema } from '@/features/loyalty/validation/loyalty';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ApproveTestimonialResult {
  /** True when the quote is now published. */
  isPublished: boolean;
}

export const approveTestimonial = createAction(
  approveTestimonialSchema,
  async (input): Promise<ApproveTestimonialResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('approve_testimonial', {
      p_testimonial_id: input.testimonialId,
    });

    if (error) {
      logger.error('A client quote could not be published', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'approve',
      entityType: 'testimonial',
      entityId: input.testimonialId,
      companyId: company.id,
      description: 'Published a client quote',
    });

    revalidatePath(`${ROUTES.loyalty}/reviews`);

    return { isPublished: data === true };
  },
  { name: 'approveTestimonial' }
);
