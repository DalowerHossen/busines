// src/app/(marketing)/pricing/page.tsx
// The pricing page: what each plan costs, what it includes and the questions
// people ask before they pay.

import type { Metadata } from 'next';

import { ClosingCta } from '@/components/marketing/closing-cta';
import { FaqSection } from '@/components/marketing/faq-section';
import { PlanComparison } from '@/components/marketing/plan-comparison';
import { PricingTable } from '@/components/marketing/pricing-table';
import { SectionHeading } from '@/components/marketing/section-heading';
import { JsonLd } from '@/components/seo/json-ld';
import { ROUTES } from '@/config/app';
import { PLANS, PLAN_CURRENCY, PRICING_FAQ } from '@/config/plans';
import { buildMetadata, faqJsonLd, siteUrl } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Pricing',
  description:
    'A free plan that stays free, and paid plans from twelve dollars a month with a fourteen day trial. No card needed to start.',
  path: ROUTES.pricing,
});

/**
 * Builds the structured data describing the plans on offer.
 *
 * @returns A JSON-LD product record.
 */
function pricingJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Invoicing and billing plans',
    description: 'Subscription plans for invoicing, payments and recurring billing.',
    url: `${siteUrl()}${ROUTES.pricing}`,
    offers: PLANS.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.monthlyPrice,
      priceCurrency: PLAN_CURRENCY,
      url: `${siteUrl()}${ROUTES.register}?plan=${plan.key}`,
      availability: 'https://schema.org/InStock',
    })),
  };
}

/**
 * Renders the pricing page.
 *
 * @returns The rendered page.
 */
export default function PricingPage() {
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50 to-background">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
          <SectionHeading
            level="h1"
            isCentred
            eyebrow="Pricing"
            title="One clear price, and a free plan that stays free"
            description="Start on the free plan and stay there as long as it suits you. Move up when the volume justifies it, and move back down whenever it does not."
          />

          <div className="mt-12">
            <PricingTable plans={PLANS} />
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Prices are in United States dollars and exclude any tax we are required to add.
          </p>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
          <SectionHeading
            title="Compare the plans line by line"
            description="Every limit and every module, so there is no surprise after you sign up."
          />

          <div className="mt-8">
            <PlanComparison />
          </div>
        </div>
      </section>

      <FaqSection
        title="Questions about paying"
        description="If the answer you need is not here, write to us and a person will reply."
        entries={PRICING_FAQ}
      />

      <ClosingCta />
      <JsonLd data={pricingJsonLd()} />
      <JsonLd data={faqJsonLd(PRICING_FAQ)} />
    </>
  );
}
