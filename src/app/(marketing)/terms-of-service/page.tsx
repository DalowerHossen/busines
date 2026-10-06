// src/app/(marketing)/terms-of-service/page.tsx
// The terms of service, published as a page rather than a download so it can
// be linked to section by section.

import type { Metadata } from 'next';

import { LegalDocumentView } from '@/components/legal/legal-document';
import { ROUTES } from '@/config/app';
import { TERMS_OF_SERVICE } from '@/content/legal/terms-of-service';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of service',
  description:
    'The agreement that applies when you use the service: what we provide, what we charge, what you are responsible for and how either side may end it.',
  path: ROUTES.termsOfService,
});

/**
 * Renders the terms of service page.
 *
 * @returns The rendered page.
 */
export default function TermsOfServicePage() {
  return <LegalDocumentView document={TERMS_OF_SERVICE} />;
}
