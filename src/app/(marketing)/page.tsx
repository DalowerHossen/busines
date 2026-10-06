// src/app/(marketing)/page.tsx
// The home page of the public website.

import type { Metadata } from 'next';

import { ClosingCta } from '@/components/marketing/closing-cta';
import { FaqSection } from '@/components/marketing/faq-section';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { TrustStrip } from '@/components/marketing/trust-strip';
import { JsonLd } from '@/components/seo/json-ld';
import { FAQ } from '@/config/marketing';
import { buildMetadata, faqJsonLd, softwareJsonLd } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Invoicing and billing for modern business',
  description:
    'Send professional invoices, take payments online, bill on a schedule and keep clean books. Free plan included.',
  path: '/',
});

/**
 * Renders the home page.
 *
 * @returns The rendered page.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <FeatureGrid />
      <HowItWorks />
      <FaqSection />
      <ClosingCta />
      <JsonLd data={softwareJsonLd()} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </>
  );
}
