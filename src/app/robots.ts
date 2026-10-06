// src/app/robots.ts
// Tells crawlers what they may read. Everything behind a sign in, and every
// page reached with a signed client link, is kept out.

import type { MetadataRoute } from 'next';

import { DATA_CRAWLER_AGENTS } from '@/lib/security/bot-defence';
import { siteUrl } from '@/lib/seo/metadata';

/**
 * Builds the robots file.
 *
 * @returns The rules served at /robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Crawlers that collect text for models and datasets are refused the
      // whole site, not merely the private parts of it.
      ...DATA_CRAWLER_AGENTS.map((agent) => ({
        userAgent: agent,
        disallow: '/',
      })),
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/admin/',
          '/reseller/',
          '/accountant/',
          '/affiliate/',
          '/onboarding/',
          '/d/',
          '/sign/',
          '/pay/',
          '/auth/',
          '/r/',
          '/setup/',
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
