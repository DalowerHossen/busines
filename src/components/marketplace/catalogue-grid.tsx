// src/components/marketplace/catalogue-grid.tsx
// The shopfront itself. Each card answers what the template is, who wrote
// it, what it costs and how many businesses already run it.

import Link from 'next/link';
import { Download, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/config/app';
import type { CatalogueEntry } from '@/features/marketplace/types';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface CatalogueGridProps {
  /** Listings on sale. */
  entries: readonly CatalogueEntry[];
}

/**
 * Renders the shopfront.
 *
 * @param props The listings on sale.
 * @returns The rendered grid.
 */
export function CatalogueGrid({ entries }: CatalogueGridProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Nothing matches that search"
        description="Clear the filters to see every template, or open the vendor desk and publish one of your own."
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => (
        <li
          key={entry.listingId}
          className="flex flex-col rounded-lg border border-border bg-surface p-4 shadow-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <Badge tone="neutral">{humanise(entry.category)}</Badge>
            <span className="tabular text-sm font-semibold text-foreground">
              {entry.pricingModel === 'free'
                ? 'Free'
                : formatMoney(entry.priceAmount, entry.priceCurrency)}
            </span>
          </div>

          <h3 className="mt-3 text-base font-semibold text-foreground">
            <Link
              href={`${ROUTES.marketplace}/${entry.listingSlug}`}
              className="text-brand-700 underline-offset-2 hover:underline"
            >
              {entry.title}
            </Link>
          </h3>

          <p className="mt-1 flex-1 text-sm text-muted-foreground">{entry.summary}</p>

          <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <dt className="visually-hidden">Vendor</dt>
              <dd className="font-medium text-foreground">{entry.vendorName}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Download aria-hidden="true" className="h-4 w-4" />
              <dt className="visually-hidden">Installs</dt>
              <dd className="tabular">{formatNumber(entry.installCount)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Star aria-hidden="true" className="h-4 w-4" />
              <dt className="visually-hidden">Rating</dt>
              <dd className="tabular">
                {entry.averageRating === null
                  ? 'Not rated yet'
                  : `${entry.averageRating} from ${formatNumber(entry.ratingCount)}`}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
