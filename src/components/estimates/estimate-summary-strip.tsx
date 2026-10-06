// src/components/estimates/estimate-summary-strip.tsx
// The pipeline view above the estimate list: what is with clients, what has
// been accepted, what is still a draft and what is about to go stale.

import { CheckCheck, FileSignature, Hourglass, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { EstimateTotals } from '@/features/estimates/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface EstimateSummaryStripProps {
  /** Totals read from the database. */
  totals: EstimateTotals;
}

interface SummaryTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Renders the figures above the estimate list.
 *
 * @param props The totals to show.
 * @returns The rendered strip.
 */
export function EstimateSummaryStrip({ totals }: EstimateSummaryStripProps) {
  const tiles: SummaryTile[] = [
    {
      key: 'open',
      label: 'With clients',
      value: formatMoney(totals.openTotal, totals.currency),
      hint: 'Sent and waiting for an answer',
      icon: FileSignature,
    },
    {
      key: 'approved',
      label: 'Accepted',
      value: formatMoney(totals.approvedTotal, totals.currency),
      hint: 'Ready to become invoices',
      icon: CheckCheck,
    },
    {
      key: 'expiring',
      label: 'Expiring soon',
      value: formatNumber(totals.expiringCount),
      hint: 'Validity ends within a week',
      icon: Hourglass,
    },
    {
      key: 'drafts',
      label: 'Drafts',
      value: formatNumber(totals.draftCount),
      hint: `${formatNumber(totals.totalCount)} quotations on record`,
      icon: Layers,
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <tile.icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="tabular text-xl font-semibold text-foreground">{tile.value}</dd>
            <p className="text-xs text-muted-foreground">{tile.hint}</p>
          </div>
        </div>
      ))}
    </dl>
  );
}
