// src/features/marketplace/queries/list-installs.ts
// What one business has installed from the marketplace, and whether a newer
// version of any of it has since been published.

import type { InstalledTemplate } from '@/features/marketplace/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface InstalledTemplateList {
  /** Templates live inside this business. */
  installs: readonly InstalledTemplate[];
  /** True when the list could not be read. */
  isDegraded: boolean;
}

/**
 * Lists the templates installed in one business.
 *
 * @param companyId Business whose installs are being read.
 * @returns The installs and whether anything had to be left out.
 */
export async function loadInstalledTemplates(companyId: string): Promise<InstalledTemplateList> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('marketplace_installs')
    .select(
      'id, listing_id, installed_version, status, installed_at, marketplace_listings:listing_id (listing_slug, title, category, version)'
    )
    .eq('company_id', companyId)
    .neq('status', 'uninstalled')
    .order('installed_at', { ascending: false });

  if (error) {
    logger.error('The installed templates could not be read', error, { companyId });

    return { installs: [], isDegraded: true };
  }

  const rows = asRows(data);
  const listingIds = rows
    .map((row) => readString(row, 'listing_id'))
    .filter((value): value is string => value !== null);

  const reviewed = new Set<string>();

  if (listingIds.length > 0) {
    const { data: reviewData } = await supabase
      .from('marketplace_reviews')
      .select('listing_id')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .in('listing_id', listingIds);

    for (const reviewRow of asRows(reviewData)) {
      const listingId = readString(reviewRow, 'listing_id');

      if (listingId !== null) {
        reviewed.add(listingId);
      }
    }
  }

  const installs = rows.map((row) => {
    const listing = asRow(row['marketplace_listings']);
    const listingId = readString(row, 'listing_id') ?? '';
    const installedVersion = readString(row, 'installed_version') ?? '1.0.0';

    return {
      installId: readString(row, 'id') ?? '',
      listingId,
      listingSlug: listing === null ? '' : (readString(listing, 'listing_slug') ?? ''),
      title: listing === null ? 'Template' : (readString(listing, 'title') ?? 'Template'),
      category: listing === null ? 'invoice_template' : (readString(listing, 'category') ?? ''),
      installedVersion,
      latestVersion:
        listing === null ? installedVersion : (readString(listing, 'version') ?? installedVersion),
      status: readString(row, 'status') ?? 'installed',
      installedAt: readString(row, 'installed_at') ?? '',
      hasReview: reviewed.has(listingId),
    };
  });

  return { installs, isDegraded: false };
}
