// src/features/marketplace/actions/apply-vendor.ts
// Opening a vendor account. Selling to other businesses is a commitment, so
// an application is reviewed by the platform before anything can be listed.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { applyVendorSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ApplyVendorResult {
  /** Identifier of the vendor account now waiting for review. */
  vendorId: string;
}

export const applyMarketplaceVendor = createAction(
  applyVendorSchema,
  async (input): Promise<ApplyVendorResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('apply_marketplace_vendor', {
      p_company_id: company.id,
      p_vendor_name: input.vendorName,
      p_vendor_slug: input.vendorSlug,
      p_support_email: input.supportEmail,
      p_headline: input.headline,
      p_bio: input.bio,
    });

    if (error) {
      logger.error('The vendor application could not be written', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', error.message);
    }

    const vendorId = typeof data === 'string' ? data : '';

    await recordAuditEntry({
      action: 'insert',
      entityType: 'marketplace_vendor',
      entityId: vendorId,
      companyId: company.id,
      description: `Applied to sell templates as ${input.vendorName}.`,
    });

    revalidatePath(`${ROUTES.marketplace}/vendor`);

    return { vendorId };
  },
  { name: 'applyMarketplaceVendor' }
);
