// src/features/admin/actions/moderate-listing.ts
// The platform decision on a listing. Publishing freezes the version buyers
// will receive; refusing it always says why.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { moderateListingSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface ModerateListingResult {
  /** The state the listing now holds. */
  status: 'published' | 'rejected';
}

export const moderateListing = createAction(
  moderateListingSchema,
  async (input): Promise<ModerateListingResult> => {
    await requireSuperAdmin();

    if (input.decision === 'reject' && input.note === null) {
      throw new AppError('validation_failed', 'Say why the listing is being refused.');
    }

    const supabase = getServiceSupabaseClient();

    const { error } =
      input.decision === 'publish'
        ? await supabase.rpc('publish_listing', {
            p_listing_id: input.listingId,
            p_changelog: input.note,
          })
        : await supabase.rpc('reject_listing', {
            p_listing_id: input.listingId,
            p_reason: input.note ?? '',
          });

    if (error) {
      logger.error('A listing decision could not be recorded', error, {
        listingId: input.listingId,
      });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: input.decision === 'publish' ? 'approve' : 'reject',
      entityType: 'marketplace_listing',
      entityId: input.listingId,
      description:
        input.decision === 'publish'
          ? 'Published a marketplace listing.'
          : 'Refused a marketplace listing.',
      metadata: { note: input.note },
    });

    revalidatePath(`${ROUTES.admin}/listings`);

    return { status: input.decision === 'publish' ? 'published' : 'rejected' };
  },
  { name: 'moderateListing' }
);
