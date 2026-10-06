// src/features/marketplace/actions/submit-listing.ts
// Sending a listing to the platform for review. Nothing reaches the
// shopfront unread, because an installed template runs inside somebody
// else's business.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { listingIdSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SubmitListingResult {
  /** True once the listing is waiting to be read. */
  isSubmitted: boolean;
}

export const submitListingForReview = createAction(
  listingIdSchema,
  async (input): Promise<SubmitListingResult> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('submit_listing_for_review', {
      p_listing_id: input.listingId,
    });

    if (error) {
      logger.error('A listing could not be sent for review', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'send',
      entityType: 'marketplace_listing',
      entityId: input.listingId,
      companyId: company.id,
      description: 'Sent a marketplace listing for review.',
    });

    revalidatePath(`${ROUTES.marketplace}/vendor`);

    return { isSubmitted: true };
  },
  { name: 'submitListingForReview' }
);
