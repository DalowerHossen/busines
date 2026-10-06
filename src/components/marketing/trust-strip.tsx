// src/components/marketing/trust-strip.tsx
// The band of numbers under the hero. Each figure is one the product can
// stand behind, written in plain words.

import { STATISTICS } from '@/config/marketing';

/**
 * Renders the band of headline figures.
 *
 * @returns The rendered strip.
 */
export function TrustStrip() {
  return (
    <section aria-label="Key figures" className="border-b border-border bg-surface">
      <dl className="mx-auto grid w-full max-w-content grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
        {STATISTICS.map((statistic) => (
          <div key={statistic.label} className="space-y-1">
            <dt className="sr-only">{statistic.label}</dt>
            <dd>
              <span className="block font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                {statistic.value}
              </span>
              <span className="block text-sm text-muted-foreground">{statistic.label}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
