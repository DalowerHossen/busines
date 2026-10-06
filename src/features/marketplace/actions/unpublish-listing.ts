// src/features/marketplace/actions/unpublish-listing.ts
// Taking a listing off sale. Everybody who already installed it keeps it;
// only new installations stop.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { unpublishListingSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UnpublishListingResult {
  /** True once the listing is no longer on sale. */
  isUnpublished: boolean;
}

export const unpublishListing = createAction(
  unpublishListingSchema,
  async (input): Promise<UnpublishListingResult> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('unpublish_listing', {
      p_listing_id: input.listingId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A listing could not be taken off sale', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'marketplace_listing',
      entityId: input.listingId,
      companyId: company.id,
      description: 'Took a marketplace listing off sale.',
      metadata: { reason: input.reason },
    });

    revalidatePath(`${ROUTES.marketplace}/vendor`);

    return { isUnpublished: true };
  },
  { name: 'unpublishListing' }
);
