// src/components/instalments/instalment-summary.tsx
// How much of the book is being paid in parts, and how much of that is late.

import { Card, CardContent } from '@/components/ui/card';
import type { InstalmentOverview } from '@/features/instalments/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface InstalmentSummaryProps {
  /** The figures to show. */
  overview: InstalmentOverview;
  /** Currency the figures are counted in. */
  currency: string;
}

/**
 * Renders the instalment summary.
 *
 * @param props The figures and the currency.
 * @returns The rendered summary.
 */
export function InstalmentSummary({ overview, currency }: InstalmentSummaryProps) {
  const cards = [
    {
      key: 'running',
      label: 'Arrangements running',
      value: formatNumber(overview.activeCount),
      note:
        overview.pendingCount > 0
          ? `${formatNumber(overview.pendingCount)} waiting for a decision`
          : 'Nothing is waiting for a decision',
    },
    {
      key: 'outstanding',
      label: 'Still to be collected',
      value: formatMoney(overview.outstandingAmount, currency),
      note: `${formatMoney(overview.collectedAmount, currency)} has come in so far`,
    },
    {
      key: 'late',
      label: 'Payments that are late',
      value: formatNumber(overview.overdueInstalments),
      note:
        overview.overdueInstalments === 0
          ? 'Everybody is up to date'
          : 'These are chased automatically each day',
    },
    {
      key: 'closed',
      label: 'Arrangements finished',
      value: formatNumber(overview.completedCount),
      note: `${formatNumber(overview.defaultedCount)} were written off as unpaid`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="tabular text-2xl font-semibold">{card.value}</p>
            <p className="text-sm text-muted-foreground">{card.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
