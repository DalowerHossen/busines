// src/components/banking/banking-summary.tsx
// How far behind the books are, in four figures, so the first thing anybody
// sees is the size of the job rather than a table.

import { Card, CardContent } from '@/components/ui/card';
import type { ReconciliationOverview } from '@/features/banking/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface BankingSummaryProps {
  /** The figures to show. */
  overview: ReconciliationOverview;
  /** Currency the backlog is counted in. */
  currency: string;
}

/**
 * Renders the reconciliation summary.
 *
 * @param props The figures and the currency.
 * @returns The rendered summary.
 */
export function BankingSummary({ overview, currency }: BankingSummaryProps) {
  const cards = [
    {
      key: 'queue',
      label: 'Lines waiting to be explained',
      value: formatNumber(overview.linesToReview),
      note:
        overview.oldestUnreviewedDate === null
          ? 'Nothing is outstanding'
          : `Oldest is from ${formatDate(overview.oldestUnreviewedDate)}`,
    },
    {
      key: 'value',
      label: 'Value of that backlog',
      value: formatMoney(overview.valueToReview, currency),
      note: `${formatNumber(overview.matchedLast30Days)} lines settled in the last thirty days`,
    },
    {
      key: 'feeds',
      label: 'Banks connected',
      value: formatNumber(overview.connections),
      note:
        overview.connectionsNeedingAttention > 0
          ? `${formatNumber(overview.connectionsNeedingAttention)} need attention`
          : 'All healthy',
    },
    {
      key: 'learned',
      label: 'Counterparties learned',
      value: formatNumber(overview.learnedCounterparties),
      note: `${formatNumber(overview.unlinkedAccounts)} feed accounts still to be mapped`,
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
