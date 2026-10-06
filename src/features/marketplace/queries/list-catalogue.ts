// src/features/marketplace/queries/list-catalogue.ts
// The shopfront. Only published listings from approved vendors reach it, and
// the database decides that, not this file.

import type { CatalogueEntry } from '@/features/marketplace/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

export interface CatalogueQuery {
  /** Narrows the shopfront to one kind of template. */
  category?: string | null;
  /** Matches the title or the summary. */
  search?: string | null;
  /** How many entries to read. */
  limit?: number;
}

export interface CatalogueResult {
  /** Listings on sale. */
  entries: readonly CatalogueEntry[];
  /** True when the shopfront could not be read. */
  isDegraded: boolean;
}

/**
 * Maps one shopfront entry.
 *
 * @param row Row returned by public.marketplace_catalogue.
 * @returns The entry the grid renders.
 */
export function toCatalogueEntry(row: DatabaseRow): CatalogueEntry {
  return {
    listingId: readString(row, 'listing_id') ?? '',
    listingSlug: readString(row, 'listing_slug') ?? '',
    title: readString(row, 'title') ?? '',
    summary: readString(row, 'summary') ?? '',
    category: readString(row, 'category') ?? 'invoice_template',
    artifactKind: readString(row, 'artifact_kind') ?? 'document_template',
    pricingModel: readString(row, 'pricing_model') ?? 'free',
    priceAmount: readAmount(row, 'price_amount'),
    priceCurrency: readString(row, 'price_currency') ?? 'USD',
    version: readString(row, 'version') ?? '1.0.0',
    installCount: readNumber(row, 'install_count') ?? 0,
    averageRating: readString(row, 'average_rating'),
    ratingCount: readNumber(row, 'rating_count') ?? 0,
    vendorId: readString(row, 'vendor_id') ?? '',
    vendorName: readString(row, 'vendor_name') ?? '',
    vendorSlug: readString(row, 'vendor_slug') ?? '',
    publishedAt: readString(row, 'published_at'),
  };
}

/**
 * Reads the published catalogue.
 *
 * @param query What to narrow the shopfront to.
 * @returns The entries on sale.
 */
export async function loadCatalogue(query: CatalogueQuery = {}): Promise<CatalogueResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('marketplace_catalogue', {
    p_category: query.category ?? null,
    p_search: query.search ?? null,
    p_limit: query.limit ?? 24,
    p_offset: 0,
  });

  if (error) {
    logger.error('The marketplace catalogue could not be read', error);

    return { entries: [], isDegraded: true };
  }

  return { entries: asRows(data).map(toCatalogueEntry), isDegraded: false };
}
