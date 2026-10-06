// src/features/site/queries/list-pages.ts
// What the website editor shows: the pages, and the addresses that moved.

import type { EditablePage, SiteRedirect } from '@/features/site/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SiteBoard {
  pages: readonly EditablePage[];
  redirects: readonly SiteRedirect[];
  /** True when something could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the pages and redirects of the public website.
 *
 * @returns The pages, the redirects and whether a read failed.
 */
export async function loadSiteBoard(): Promise<SiteBoard> {
  const supabase = createServerSupabaseClient();

  const [pages, redirects] = await Promise.all([
    supabase.rpc('site_page_list', { p_include_drafts: true }),
    supabase.rpc('url_redirect_list'),
  ]);

  if (pages.error || redirects.error) {
    logger.error('The website editor could not be read', pages.error ?? redirects.error);

    return { pages: [], redirects: [], isDegraded: true };
  }

  return {
    pages: asRows(pages.data).map((row) => ({
      pageId: readString(row, 'page_id') ?? '',
      slug: readString(row, 'slug') ?? '',
      title: readString(row, 'title') ?? '',
      pageType: readString(row, 'page_type') ?? 'marketing',
      isPublished: readBoolean(row, 'is_published'),
      showInNavigation: readBoolean(row, 'show_in_navigation'),
      navigationOrder: readNumber(row, 'navigation_order') ?? 100,
      metaTitle: readString(row, 'meta_title'),
      metaDescription: readString(row, 'meta_description'),
      robotsDirective: readString(row, 'robots_directive') ?? 'index,follow',
      sitemapPriority: readAmount(row, 'sitemap_priority'),
      viewCount: readNumber(row, 'view_count') ?? 0,
      updatedAt: readString(row, 'updated_at') ?? '',
      seoWarning: readString(row, 'seo_warning'),
    })),
    redirects: asRows(redirects.data).map((row) => ({
      redirectId: readString(row, 'redirect_id') ?? '',
      sourcePath: readString(row, 'source_path') ?? '',
      targetPath: readString(row, 'target_path') ?? '',
      statusCode: readNumber(row, 'status_code') ?? 301,
      reason: readString(row, 'reason'),
      isActive: readBoolean(row, 'is_active'),
      hitCount: readNumber(row, 'hit_count') ?? 0,
      lastHitAt: readString(row, 'last_hit_at'),
    })),
    isDegraded: false,
  };
}
