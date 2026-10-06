// src/features/admin/queries/list-listing-queue.ts
// What the platform team has to read before it reaches anybody else: the
// listings waiting for review and the vendors waiting to be let in.

import type { ListingQueueEntry, VendorProfile } from '@/features/marketplace/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readNumber, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { DatabaseRow } from '@/types/database';

export interface ListingQueue {
  /** Listings waiting to be read. */
  listings: readonly ListingQueueEntry[];
  /** Vendor accounts waiting to be let in. */
  vendors: readonly VendorProfile[];
  /** True when the queue could not be read. */
  isDegraded: boolean;
}

/**
 * Maps one listing waiting for review.
 *
 * @param row Row read from public.marketplace_listings.
 * @returns The entry the queue renders.
 */
function toQueueEntry(row: DatabaseRow): ListingQueueEntry {
  const vendor = asRow(row['marketplace_vendors']);

  return {
    listingId: readString(row, 'id') ?? '',
    title: readString(row, 'title') ?? '',
    summary: readString(row, 'summary') ?? '',
    category: readString(row, 'category') ?? 'invoice_template',
    artifactKind: readString(row, 'artifact_kind') ?? 'document_template',
    pricingModel: readString(row, 'pricing_model') ?? 'free',
    priceAmount: readAmount(row, 'price_amount'),
    priceCurrency: readString(row, 'price_currency') ?? 'USD',
    version: readString(row, 'version') ?? '1.0.0',
    status: readString(row, 'status') ?? 'in_review',
    submittedAt: readString(row, 'submitted_at'),
    vendorId: readString(row, 'vendor_id') ?? '',
    vendorName: vendor === null ? 'Vendor' : (readString(vendor, 'vendor_name') ?? 'Vendor'),
    vendorStatus: vendor === null ? 'pending_review' : (readString(vendor, 'status') ?? ''),
  };
}

/**
 * Maps one vendor waiting to be let in.
 *
 * @param row Row read from public.marketplace_vendors.
 * @returns The vendor the queue renders.
 */
function toVendor(row: DatabaseRow): VendorProfile {
  return {
    id: readString(row, 'id') ?? '',
    companyId: readString(row, 'company_id'),
    vendorName: readString(row, 'vendor_name') ?? '',
    vendorSlug: readString(row, 'vendor_slug') ?? '',
    headline: readString(row, 'headline'),
    bio: readString(row, 'bio'),
    supportEmail: readString(row, 'support_email'),
    websiteUrl: readString(row, 'website_url'),
    status: readString(row, 'status') ?? 'pending_review',
    revenueSharePercentage: readAmount(row, 'revenue_share_percentage', '70'),
    payoutCurrency: readString(row, 'payout_currency') ?? 'USD',
    listingCount: readNumber(row, 'listing_count') ?? 0,
    installCount: readNumber(row, 'install_count') ?? 0,
    lifetimeEarnings: readAmount(row, 'lifetime_earnings'),
    averageRating: readString(row, 'average_rating'),
    approvedAt: readString(row, 'approved_at'),
  };
}

/**
 * Reads the marketplace moderation queue.
 *
 * @returns The listings and vendors waiting for a decision.
 */
export async function loadListingQueue(): Promise<ListingQueue> {
  const supabase = getServiceSupabaseClient();

  const [listingResult, vendorResult] = await Promise.all([
    supabase
      .from('marketplace_listings')
      .select(
        'id, title, summary, category, artifact_kind, pricing_model, price_amount, price_currency, version, status, submitted_at, vendor_id, marketplace_vendors:vendor_id (vendor_name, status)'
      )
      .in('status', ['in_review', 'published', 'rejected'])
      .is('deleted_at', null)
      .order('submitted_at', { ascending: true })
      .limit(60),
    supabase
      .from('marketplace_vendors')
      .select(
        'id, company_id, vendor_name, vendor_slug, headline, bio, support_email, website_url, status, revenue_share_percentage, payout_currency, listing_count, install_count, lifetime_earnings, average_rating, approved_at'
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(60),
  ]);

  if (listingResult.error) {
    logger.error('The marketplace queue could not be read', listingResult.error);
  }

  return {
    listings: asRows(listingResult.data).map(toQueueEntry),
    vendors: asRows(vendorResult.data).map(toVendor),
    isDegraded: listingResult.error !== null || vendorResult.error !== null,
  };
}
