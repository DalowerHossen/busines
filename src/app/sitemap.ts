// src/app/sitemap.ts
// The list of public pages, offered to search engines.

import type { MetadataRoute } from 'next';

import { ROUTES } from '@/config/app';
import { logger } from '@/lib/logger';
import { siteUrl } from '@/lib/seo/metadata';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { isJsonObject } from '@/types/json';

interface SitemapEntry {
  path: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

const PUBLIC_PAGES: readonly SitemapEntry[] = [
  { path: ROUTES.home, changeFrequency: 'weekly', priority: 1 },
  { path: ROUTES.features, changeFrequency: 'weekly', priority: 0.9 },
  { path: ROUTES.pricing, changeFrequency: 'weekly', priority: 0.9 },
  { path: ROUTES.developerDocs, changeFrequency: 'monthly', priority: 0.7 },
  { path: ROUTES.contact, changeFrequency: 'monthly', priority: 0.6 },
  { path: ROUTES.register, changeFrequency: 'monthly', priority: 0.7 },
  { path: ROUTES.login, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTES.termsOfService, changeFrequency: 'yearly', priority: 0.3 },
  { path: ROUTES.privacyPolicy, changeFrequency: 'yearly', priority: 0.3 },
  { path: ROUTES.cookiePolicy, changeFrequency: 'yearly', priority: 0.3 },
];

/**
 * Reads the pages written in the website editor.
 *
 * @returns One entry per published page, or nothing when they cannot be read.
 */
async function editorPages(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase.rpc('sitemap_entries');

    if (error || !Array.isArray(data)) {
      return [];
    }

    return data.flatMap((entry) => {
      if (!isJsonObject(entry)) {
        return [];
      }

      const path = entry['path'];

      if (typeof path !== 'string') {
        return [];
      }

      const changed = entry['last_modified'];
      const priority = entry['priority'];

      return [
        {
          url: `${siteUrl()}${path === '/' ? '' : path}`,
          lastModified: typeof changed === 'string' ? new Date(changed) : new Date(),
          changeFrequency: 'monthly' as const,
          priority: typeof priority === 'number' ? priority : Number(priority ?? 0.5) || 0.5,
        },
      ];
    });
  } catch (cause) {
    // A sitemap that fails to build should not take the site down with it.
    logger.warn('The editor pages could not be added to the sitemap', {
      message: cause instanceof Error ? cause.message : 'unknown',
    });

    return [];
  }
}

/**
 * Builds the sitemap.
 *
 * @returns The entries served at /sitemap.xml.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const fromEditor = await editorPages();

  const built = PUBLIC_PAGES.map((page) => ({
    url: `${siteUrl()}${page.path === '/' ? '' : page.path}`,
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // A page built in code wins over one of the same address in the editor,
  // because that is the one a visitor actually lands on.
  const known = new Set(built.map((entry) => entry.url));

  return [...built, ...fromEditor.filter((entry) => !known.has(entry.url))];
}
