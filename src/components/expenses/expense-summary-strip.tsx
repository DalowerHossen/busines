// src/components/expenses/expense-summary-strip.tsx
// The figures above the expense list: what has been spent, what still has to
// be paid, what can be recharged, and what is waiting for an answer.

import { Clock, Receipt, Repeat2, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ExpenseTotals } from '@/features/expenses/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface ExpenseSummaryStripProps {
  /** Totals read from the database. */
  totals: ExpenseTotals;
}

interface SummaryTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Renders the figures above the expense list.
 *
 * @param props The totals to show.
 * @returns The rendered strip.
 */
export function ExpenseSummaryStrip({ totals }: ExpenseSummaryStripProps) {
  const tiles: SummaryTile[] = [
    {
      key: 'spend',
      label: 'Total recorded',
      value: formatMoney(totals.totalSpend, totals.currency),
      hint: 'Everything on record except rejected claims',
      icon: Receipt,
    },
    {
      key: 'awaiting',
      label: 'Still to pay',
      value: formatMoney(totals.awaitingPayment, totals.currency),
      hint: 'Claims and bills that have not been settled',
      icon: Wallet,
    },
    {
      key: 'recharge',
      label: 'To recharge',
      value: formatMoney(totals.rechargeable, totals.currency),
      hint: 'Billable spending not yet on an invoice',
      icon: Repeat2,
    },
    {
      key: 'approval',
      label: 'Waiting for approval',
      value: formatNumber(totals.awaitingApprovalCount),
      hint: `${formatNumber(totals.totalCount)} claims on record`,
      icon: Clock,
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
