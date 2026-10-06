// src/features/marketplace/queries/get-listing.ts
// One listing in full, with the vendor behind it and what buyers said about
// it afterwards.

import type { ListingDetail, ListingReview } from '@/features/marketplace/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readNumber, readString, readStringArray } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

export interface ListingPage {
  /** The listing being viewed. */
  listing: ListingDetail;
  /** What buyers said, newest first. */
  reviews: readonly ListingReview[];
  /** Identifier of the install this business already has, when it has one. */
  installId: string | null;
}

const LISTING_COLUMNS =
  'id, listing_slug, title, summary, description, category, tags, artifact_kind, demo_url, pricing_model, price_amount, price_currency, version, install_count, rating_total, rating_count, published_at, vendor_id';

const VENDOR_COLUMNS = 'id, vendor_name, vendor_slug, headline, support_email, status';

/**
 * Maps one buyer review.
 *
 * @param row Row read from public.marketplace_reviews.
 * @returns The review the page renders.
 */
function toReview(row: DatabaseRow): ListingReview {
  return {
    id: readString(row, 'id') ?? '',
    rating: readNumber(row, 'rating') ?? 5,
    title: readString(row, 'title'),
    body: readString(row, 'body'),
    vendorReply: readString(row, 'vendor_reply'),
    createdAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Reads one listing by its address.
 *
 * @param listingSlug Address of the listing.
 * @param companyId Business viewing it, when there is one.
 * @returns The listing page, or null when nothing is published under that address.
 */
export async function loadListingPage(
  listingSlug: string,
  companyId: string | null
): Promise<ListingPage | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(LISTING_COLUMNS)
    .eq('listing_slug', listingSlug)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    logger.error('A marketplace listing could not be read', error, { listingSlug });

    return null;
  }

  const row = asRow(data);

  if (row === null) {
    return null;
  }

  const vendorId = readString(row, 'vendor_id') ?? '';

  const [vendorResult, reviewResult, installResult] = await Promise.all([
    supabase.from('marketplace_vendors').select(VENDOR_COLUMNS).eq('id', vendorId).maybeSingle(),
    supabase
      .from('marketplace_reviews')
      .select('id, rating, title, body, vendor_reply, created_at')
      .eq('listing_id', readString(row, 'id') ?? '')
      .eq('is_visible', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    companyId === null
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from('marketplace_installs')
          .select('id, status')
          .eq('listing_id', readString(row, 'id') ?? '')
          .eq('company_id', companyId)
          .neq('status', 'uninstalled')
          .maybeSingle(),
  ]);

  const vendorRow = asRow(vendorResult.data);
  const ratingCount = readNumber(row, 'rating_count') ?? 0;
  const ratingTotal = readNumber(row, 'rating_total') ?? 0;
  const installRow = asRow(installResult.data);

  return {
    listing: {
      listingId: readString(row, 'id') ?? '',
      listingSlug: readString(row, 'listing_slug') ?? '',
      title: readString(row, 'title') ?? '',
      summary: readString(row, 'summary') ?? '',
      description: readString(row, 'description'),
      category: readString(row, 'category') ?? 'invoice_template',
      artifactKind: readString(row, 'artifact_kind') ?? 'document_template',
      tags: readStringArray(row, 'tags'),
      demoUrl: readString(row, 'demo_url'),
      pricingModel: readString(row, 'pricing_model') ?? 'free',
      priceAmount: readAmount(row, 'price_amount'),
      priceCurrency: readString(row, 'price_currency') ?? 'USD',
      version: readString(row, 'version') ?? '1.0.0',
      installCount: readNumber(row, 'install_count') ?? 0,
      averageRating: ratingCount === 0 ? null : (ratingTotal / ratingCount).toFixed(2),
      ratingCount,
      vendorId,
      vendorName: vendorRow === null ? 'Vendor' : (readString(vendorRow, 'vendor_name') ?? ''),
      vendorSlug: vendorRow === null ? '' : (readString(vendorRow, 'vendor_slug') ?? ''),
      vendorHeadline: vendorRow === null ? null : readString(vendorRow, 'headline'),
      vendorSupportEmail: vendorRow === null ? null : readString(vendorRow, 'support_email'),
      publishedAt: readString(row, 'published_at'),
    },
    reviews: asRows(reviewResult.data).map(toReview),
    installId: installRow === null ? null : readString(installRow, 'id'),
  };
}
