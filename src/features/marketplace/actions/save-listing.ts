// src/features/marketplace/actions/save-listing.ts
// Writing a listing. A vendor owns every word of it, but never its state:
// draft, review and publication are decided elsewhere, which is why no
// status is written here.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveListingSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type JsonObject } from '@/types/json';

export interface SaveListingResult {
  /** Identifier of the listing that was written. */
  listingId: string;
}

/**
 * Reads the packaged content of a listing from the text a vendor typed.
 *
 * @param payload JSON text from the form.
 * @returns The parsed object.
 */
function parsePayload(payload: string): JsonObject {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new AppError('validation_failed', 'The template content has to be valid JSON.', {
      fieldErrors: { artifactPayload: ['This is not valid JSON.'] },
    });
  }

  if (!isJsonObject(parsed)) {
    throw new AppError('validation_failed', 'The template content has to be a JSON object.', {
      fieldErrors: { artifactPayload: ['Wrap the content in curly braces.'] },
    });
  }

  return parsed;
}

export const saveListing = createAction(
  saveListingSchema,
  async (input): Promise<SaveListingResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const payload = parsePayload(input.artifactPayload);

    const { data: vendorData, error: vendorError } = await supabase
      .from('marketplace_vendors')
      .select('id, status')
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (vendorError) {
      logger.error('The vendor behind a listing could not be read', vendorError, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'The listing could not be saved. Please try again.');
    }

    const vendor = asRow(vendorData);

    if (vendor === null) {
      throw new AppError('forbidden', 'Open a vendor account before you write a listing.');
    }

    const fields = {
      listing_slug: input.listingSlug,
      title: input.title,
      summary: input.summary,
      description: input.description,
      category: input.category,
      artifact_kind: input.artifactKind,
      artifact_payload: payload,
      pricing_model: input.pricingModel,
      price_amount: input.priceAmount,
      price_currency: input.priceCurrency,
      version: input.version,
    };

    if (input.listingId === null) {
      const { data: inserted, error: insertError } = await supabase
        .from('marketplace_listings')
        .insert({ ...fields, vendor_id: readString(vendor, 'id') ?? '' })
        .select('id')
        .maybeSingle();

      if (insertError) {
        logger.error('A listing could not be written', insertError, { companyId: company.id });

        throw new AppError('database_failure', insertError.message);
      }

      const insertedRow = asRow(inserted);
      const listingId = insertedRow === null ? '' : (readString(insertedRow, 'id') ?? '');

      await recordAuditEntry({
        action: 'insert',
        entityType: 'marketplace_listing',
        entityId: listingId,
        companyId: company.id,
        description: `Wrote the marketplace listing ${input.title}.`,
      });

      revalidatePath(`${ROUTES.marketplace}/vendor`);

      return { listingId };
    }

    const { error: updateError } = await supabase
      .from('marketplace_listings')
      .update(fields)
      .eq('id', input.listingId);

    if (updateError) {
      logger.error('A listing could not be changed', updateError, { companyId: company.id });

      throw new AppError('database_failure', updateError.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'marketplace_listing',
      entityId: input.listingId,
      companyId: company.id,
      description: `Changed the marketplace listing ${input.title}.`,
    });

    revalidatePath(`${ROUTES.marketplace}/vendor`);

    return { listingId: input.listingId };
  },
  { name: 'saveListing' }
);
