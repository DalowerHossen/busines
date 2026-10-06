// src/components/payments/payment-summary-strip.tsx
// The money view above the payment list: what came in this month, what is
// still waiting to be applied, and how large the record is.

import { CalendarCheck, Coins, HandCoins, Hourglass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PaymentTotals } from '@/features/payments/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface PaymentSummaryStripProps {
  /** Totals read from the database. */
  totals: PaymentTotals;
}

interface SummaryTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Renders the figures above the payment list.
 *
 * @param props The totals to show.
 * @returns The rendered strip.
 */
export function PaymentSummaryStrip({ totals }: PaymentSummaryStripProps) {
  const tiles: SummaryTile[] = [
    {
      key: 'month',
      label: 'Received this month',
      value: formatMoney(totals.receivedThisMonth, totals.currency),
      hint: 'Settled payments only',
      icon: CalendarCheck,
    },
    {
      key: 'unallocated',
      label: 'Waiting to be applied',
      value: formatMoney(totals.unallocatedTotal, totals.currency),
      hint: `${formatNumber(totals.unallocatedCount)} payment${totals.unallocatedCount === 1 ? '' : 's'} with money left over`,
      icon: Hourglass,
    },
    {
      key: 'count',
      label: 'Payments',
      value: formatNumber(totals.paymentCount),
      hint: 'On record for this business',
      icon: HandCoins,
    },
    {
      key: 'currency',
      label: 'Reporting currency',
      value: totals.currency,
      hint: 'Totals are converted into this currency',
      icon: Coins,
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
