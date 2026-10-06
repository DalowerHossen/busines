// src/features/site/queries/get-public-page.ts
// Reading one published page for the public website.

import 'server-only';

import type { ContentBlock, PublicPage } from '@/features/site/types';
import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { isJsonObject } from '@/types/json';

/**
 * Turns the stored blocks into something the renderer can draw.
 *
 * @param value The stored block list.
 * @returns The blocks, ignoring anything malformed.
 */
function toBlocks(value: unknown): readonly ContentBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isJsonObject(entry)) {
      return [];
    }

    const items = entry['items'];

    return [
      {
        kind: typeof entry['kind'] === 'string' ? entry['kind'] : 'paragraph',
        heading: typeof entry['heading'] === 'string' ? entry['heading'] : null,
        body: typeof entry['body'] === 'string' ? entry['body'] : null,
        items: Array.isArray(items)
          ? items.filter((item): item is string => typeof item === 'string')
          : [],
      },
    ];
  });
}

/**
 * Reads one published page.
 *
 * @param slug Address of the page, without the leading slash.
 * @returns The page, or null when there is nothing public there.
 */
export async function loadPublicPage(slug: string): Promise<PublicPage | null> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('published_site_page', { p_slug: slug });

  if (error) {
    logger.error('A public page could not be read', error, { slug });

    return null;
  }

  if (!isJsonObject(data)) {
    return null;
  }

  /**
   * Reads a string out of the page.
   *
   * @param key Field being read.
   * @returns The value, or null.
   */
  function text(key: string): string | null {
    const value = isJsonObject(data) ? data[key] : null;

    return typeof value === 'string' && value !== '' ? value : null;
  }

  return {
    pageId: text('page_id') ?? '',
    slug: text('slug') ?? slug,
    title: text('title') ?? '',
    pageType: text('page_type') ?? 'marketing',
    blocks: toBlocks(data['content_blocks']),
    excerpt: text('excerpt'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    canonicalUrl: text('canonical_url'),
    openGraphTitle: text('open_graph_title'),
    openGraphDescription: text('open_graph_description'),
    openGraphImageUrl: text('open_graph_image_url'),
    robotsDirective: text('robots_directive') ?? 'index,follow',
    updatedAt: text('updated_at') ?? '',
  };
}

/**
 * Looks up where an old address now points.
 *
 * @param path The address that was asked for.
 * @returns Where to send the visitor, or null when nothing is registered.
 */
export async function followRedirect(
  path: string
): Promise<{ target: string; status: number } | null> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('follow_redirect', { p_source_path: path });

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0];

  if (!isJsonObject(row)) {
    return null;
  }

  const target = row['target_path'];
  const status = row['status_code'];

  if (typeof target !== 'string') {
    return null;
  }

  return { target, status: typeof status === 'number' ? status : 301 };
}
