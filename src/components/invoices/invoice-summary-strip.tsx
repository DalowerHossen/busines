// src/components/invoices/invoice-summary-strip.tsx
// The money view above the invoice list: what is owed, what is late, how many
// drafts are waiting and how large the book is.

import { AlarmClock, FileStack, FileText, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { InvoiceTotals } from '@/features/invoices/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface InvoiceSummaryStripProps {
  /** Totals read from the database. */
  totals: InvoiceTotals;
}

interface SummaryTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Renders the figures above the invoice list.
 *
 * @param props The totals to show.
 * @returns The rendered strip.
 */
export function InvoiceSummaryStrip({ totals }: InvoiceSummaryStripProps) {
  const tiles: SummaryTile[] = [
    {
      key: 'outstanding',
      label: 'Outstanding',
      value: formatMoney(totals.outstandingTotal, totals.currency),
      hint: 'Issued and not yet settled',
      icon: Wallet,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: formatMoney(totals.overdueTotal, totals.currency),
      hint: `${formatNumber(totals.overdueCount)} past the due date`,
      icon: AlarmClock,
    },
    {
      key: 'drafts',
      label: 'Drafts',
      value: formatNumber(totals.draftCount),
      hint: 'Written but not issued',
      icon: FileText,
    },
    {
      key: 'total',
      label: 'Invoices',
      value: formatNumber(totals.totalCount),
      hint: 'On record for this business',
      icon: FileStack,
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
