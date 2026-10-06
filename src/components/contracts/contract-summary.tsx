// src/components/contracts/contract-summary.tsx
// Where the agreements stand, in four figures: what is still being written,
// what is out with a client, what has been agreed and what came to nothing.

import { Card, CardContent } from '@/components/ui/card';
import type { ContractOverview } from '@/features/contracts/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface ContractSummaryProps {
  /** The figures to show. */
  overview: ContractOverview;
  /** Currency the values are counted in. */
  currency: string;
}

/**
 * Renders the agreement summary.
 *
 * @param props The figures and the currency.
 * @returns The rendered summary.
 */
export function ContractSummary({ overview, currency }: ContractSummaryProps) {
  const cards = [
    {
      key: 'draft',
      label: 'Still being written',
      value: formatNumber(overview.draftCount),
      note: 'Nobody has been asked to sign these yet',
    },
    {
      key: 'awaiting',
      label: 'Out for signature',
      value: formatNumber(overview.awaitingCount),
      note:
        overview.closingSoon > 0
          ? `${formatNumber(overview.closingSoon)} close within a week`
          : 'None are about to close',
    },
    {
      key: 'value',
      label: 'Value waiting on a signature',
      value: formatMoney(overview.awaitingValue, currency),
      note: `${formatMoney(overview.signedValue, currency)} has been agreed`,
    },
    {
      key: 'completed',
      label: 'Signed by everybody',
      value: formatNumber(overview.completedCount),
      note: `${formatNumber(overview.declinedCount)} were declined, stopped or ran out of time`,
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
