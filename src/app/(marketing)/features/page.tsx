// src/app/(marketing)/features/page.tsx
// The features page: what the product does, one capability at a time.

import type { Metadata } from 'next';
import Link from 'next/link';

import { ClosingCta } from '@/components/marketing/closing-cta';
import { FeatureSections } from '@/components/marketing/feature-sections';
import { SectionHeading } from '@/components/marketing/section-heading';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/config/app';
import {
  FEATURES_PAGE_INTRO,
  FEATURE_BLOCKS,
  FEATURE_HIGHLIGHT_STATS,
} from '@/config/content/features-page';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Features',
  description:
    'Invoices, online payments, subscriptions, reminders, expenses, projects and reporting, with strict separation between businesses and a full audit trail.',
  path: ROUTES.features,
});

/**
 * Renders the features page.
 *
 * @returns The rendered page.
 */
export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50 to-background">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
          <SectionHeading
            level="h1"
            eyebrow={FEATURES_PAGE_INTRO.eyebrow}
            title={FEATURES_PAGE_INTRO.title}
            description={FEATURES_PAGE_INTRO.description}
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={ROUTES.register} className={buttonVariants({ size: 'lg' })}>
              Start free
            </Link>
            <Link
              href={ROUTES.pricing}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              See pricing
            </Link>
          </div>

          <dl className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_HIGHLIGHT_STATS.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-surface p-5">
                <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="tabular mt-1 text-2xl font-semibold text-foreground">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <nav aria-label="Features on this page" className="mt-10">
            <ul className="flex flex-wrap gap-2">
              {FEATURE_BLOCKS.map((block) => (
                <li key={block.id}>
                  <a
                    href={`#${block.id}`}
                    className="inline-flex min-h-touch items-center rounded-full border border-border bg-surface px-4 text-sm text-foreground transition-colors duration-fast hover:bg-surface-muted"
                  >
                    {block.eyebrow}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <FeatureSections />
      <ClosingCta />
    </>
  );
}
