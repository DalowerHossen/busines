// src/features/marketplace/queries/get-vendor-desk.ts
// Everything a vendor sees about their own shop: the profile the platform
// approved, the listings they have written, and the money behind them.

import type {
  VendorDesk,
  VendorEarnings,
  VendorListing,
  VendorProfile,
} from '@/features/marketplace/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

const VENDOR_COLUMNS =
  'id, company_id, vendor_name, vendor_slug, headline, bio, support_email, website_url, status, revenue_share_percentage, payout_currency, listing_count, install_count, lifetime_earnings, average_rating, approved_at';

/**
 * Maps the vendor profile.
 *
 * @param row Row read from public.marketplace_vendors.
 * @returns The profile the desk renders.
 */
function toProfile(row: DatabaseRow): VendorProfile {
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
 * Maps one listing on the vendor desk.
 *
 * @param row Row returned by public.vendor_listings.
 * @returns The listing the table renders.
 */
function toListing(row: DatabaseRow): VendorListing {
  return {
    listingId: readString(row, 'listing_id') ?? '',
    listingSlug: readString(row, 'listing_slug') ?? '',
    title: readString(row, 'title') ?? '',
    category: readString(row, 'category') ?? 'invoice_template',
    pricingModel: readString(row, 'pricing_model') ?? 'free',
    priceAmount: readAmount(row, 'price_amount'),
    priceCurrency: readString(row, 'price_currency') ?? 'USD',
    version: readString(row, 'version') ?? '1.0.0',
    status: readString(row, 'status') ?? 'draft',
    installCount: readNumber(row, 'install_count') ?? 0,
    purchaseCount: readNumber(row, 'purchase_count') ?? 0,
    ratingCount: readNumber(row, 'rating_count') ?? 0,
    reviewNotes: readString(row, 'review_notes'),
    submittedAt: readString(row, 'submitted_at'),
    publishedAt: readString(row, 'published_at'),
    updatedAt: readString(row, 'updated_at') ?? '',
  };
}

/**
 * Maps the earnings summary.
 *
 * @param row Row returned by public.vendor_earnings_summary.
 * @returns The earnings the desk renders.
 */
function toEarnings(row: DatabaseRow): VendorEarnings {
  return {
    pendingAmount: readAmount(row, 'pending_amount'),
    availableAmount: readAmount(row, 'available_amount'),
    paidAmount: readAmount(row, 'paid_amount'),
    reversedAmount: readAmount(row, 'reversed_amount'),
    currency: readString(row, 'currency') ?? 'USD',
  };
}

/**
 * Reads the vendor desk of one business.
 *
 * @param companyId Business that may hold a vendor account.
 * @returns The desk, empty when the business does not sell yet.
 */
export async function loadVendorDesk(companyId: string): Promise<VendorDesk> {
  const supabase = createServerSupabaseClient();
  const empty: VendorDesk = { profile: null, listings: [], earnings: null, isDegraded: false };

  const { data, error } = await supabase
    .from('marketplace_vendors')
    .select(VENDOR_COLUMNS)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    logger.error('The vendor profile could not be read', error, { companyId });

    return { ...empty, isDegraded: true };
  }

  const row = asRow(data);

  if (row === null) {
    return empty;
  }

  const profile = toProfile(row);

  const [listingResult, earningsResult] = await Promise.all([
    supabase.rpc('vendor_listings', { p_vendor_id: profile.id }),
    supabase.rpc('vendor_earnings_summary', { p_vendor_id: profile.id }),
  ]);

  const earningsRow = asRows(earningsResult.data)[0];

  return {
    profile,
    listings: asRows(listingResult.data).map(toListing),
    earnings: earningsRow === undefined ? null : toEarnings(earningsRow),
    isDegraded: listingResult.error !== null || earningsResult.error !== null,
  };
}
