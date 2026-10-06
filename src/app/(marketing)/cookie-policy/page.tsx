// src/app/(marketing)/cookie-policy/page.tsx
// The cookie policy, listing each category of cookie and how to change the
// answer given to the banner.

import type { Metadata } from 'next';

import { LegalDocumentView } from '@/components/legal/legal-document';
import { ROUTES } from '@/config/app';
import { COOKIE_POLICY } from '@/content/legal/cookie-policy';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Cookie policy',
  description:
    'The cookies this website and application set, grouped by what they do, and how to change what you allow at any time.',
  path: ROUTES.cookiePolicy,
});

/**
 * Renders the cookie policy page.
 *
 * @returns The rendered page.
 */
export default function CookiePolicyPage() {
  return <LegalDocumentView document={COOKIE_POLICY} />;
}
