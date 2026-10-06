// src/components/products/product-summary-strip.tsx
// The counts above the catalogue, so the shape of what is being sold is clear
// before a single row is read.

import { Boxes, Package, Sparkles, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ProductCounts } from '@/features/products/queries/list-products';
import { formatNumber } from '@/lib/format';

export interface ProductSummaryStripProps {
  /** Counts read from the database. */
  counts: ProductCounts;
}

interface SummaryTile {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
}

/**
 * Renders the counts above the catalogue.
 *
 * @param props The counts to show.
 * @returns The rendered strip.
 */
export function ProductSummaryStrip({ counts }: ProductSummaryStripProps) {
  const tiles: SummaryTile[] = [
    { key: 'total', label: 'Items', value: counts.total, icon: Package },
    { key: 'active', label: 'Active', value: counts.active, icon: Sparkles },
    { key: 'services', label: 'Services', value: counts.services, icon: Wrench },
    { key: 'tracked', label: 'Stock tracked', value: counts.tracked, icon: Boxes },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <tile.icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="tabular text-xl font-semibold text-foreground">
              {formatNumber(tile.value)}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
