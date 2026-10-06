// src/features/admin/actions/review-vendor.ts
// Letting a vendor into the marketplace, or closing the application. The
// revenue share is set at the same moment, because that is the one term the
// vendor cannot set for itself.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { reviewVendorSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface ReviewVendorResult {
  /** The state the vendor account now holds. */
  status: string;
}

export const reviewMarketplaceVendor = createAction(
  reviewVendorSchema,
  async (input): Promise<ReviewVendorResult> => {
    await requireSuperAdmin();

    if (!input.approve && input.note === null) {
      throw new AppError('validation_failed', 'Say why the application is being refused.');
    }

    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase.rpc('review_marketplace_vendor', {
      p_vendor_id: input.vendorId,
      p_approve: input.approve,
      p_note: input.note,
      p_revenue_share: input.revenueSharePercentage,
    });

    if (error) {
      logger.error('A vendor decision could not be recorded', error, { vendorId: input.vendorId });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: input.approve ? 'approve' : 'reject',
      entityType: 'marketplace_vendor',
      entityId: input.vendorId,
      description: input.approve
        ? 'Approved a marketplace vendor.'
        : 'Closed a marketplace vendor application.',
      metadata: { note: input.note },
    });

    revalidatePath(`${ROUTES.admin}/listings`);

    return { status: typeof data === 'string' ? data : 'pending_review' };
  },
  { name: 'reviewMarketplaceVendor' }
);
