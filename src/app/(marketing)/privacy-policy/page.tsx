// src/app/(marketing)/privacy-policy/page.tsx
// The privacy policy, covering both the information we hold about our own
// customers and the information they hold about theirs.

import type { Metadata } from 'next';

import { LegalDocumentView } from '@/components/legal/legal-document';
import { ROUTES } from '@/config/app';
import { PRIVACY_POLICY } from '@/content/legal/privacy-policy';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy policy',
  description:
    'What personal information we collect, why we collect it, who it is shared with, how long we keep it and the rights you can exercise.',
  path: ROUTES.privacyPolicy,
});

/**
 * Renders the privacy policy page.
 *
 * @returns The rendered page.
 */
export default function PrivacyPolicyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
