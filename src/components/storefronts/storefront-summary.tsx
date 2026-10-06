// src/components/storefronts/storefront-summary.tsx
// The four numbers that say whether the shop side of the business is working.

import { Card, CardContent } from '@/components/ui/card';
import type { StorefrontOverview } from '@/features/storefronts/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface StorefrontSummaryProps {
  /** The counts as the database reported them. */
  overview: StorefrontOverview;
  /** Currency the business bills in. */
  currency: string;
}

/**
 * Renders the shop summary.
 *
 * @param props The counts and the currency.
 * @returns The rendered summary.
 */
export function StorefrontSummary({ overview, currency }: StorefrontSummaryProps) {
  const tiles = [
    { label: 'Shops connected', value: formatNumber(overview.connectionCount) },
    { label: 'Taking payment', value: formatNumber(overview.liveCount) },
    { label: 'Orders received', value: formatNumber(overview.orderCount) },
    { label: 'Collected', value: formatMoney(overview.collectedAmount, currency) },
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="tabular text-2xl font-semibold">{tile.value}</dd>
          </CardContent>
        </Card>
      ))}
    </dl>
  );
}
