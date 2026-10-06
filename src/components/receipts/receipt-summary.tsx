// src/components/receipts/receipt-summary.tsx
// How the reading is going, in four figures, so somebody can tell at a
// glance whether the queue needs an hour or a minute.

import { Card, CardContent } from '@/components/ui/card';
import type { ReceiptCounts } from '@/features/receipts/types';
import { formatNumber } from '@/lib/format';

export interface ReceiptSummaryProps {
  /** The counts to show. */
  counts: ReceiptCounts;
}

/**
 * Renders the receipt summary.
 *
 * @param props The counts.
 * @returns The rendered summary.
 */
export function ReceiptSummary({ counts }: ReceiptSummaryProps) {
  const confidence = Number(counts.averageConfidence);

  const cards = [
    {
      key: 'waiting',
      label: 'Waiting to be read',
      value: formatNumber(counts.waiting),
      note: counts.waiting === 0 ? 'Nothing in the reader' : 'Usually read within a few minutes',
    },
    {
      key: 'review',
      label: 'Needing a person',
      value: formatNumber(counts.needsReview),
      note: 'Check the figures before they become expenses',
    },
    {
      key: 'accepted',
      label: 'Turned into expenses',
      value: formatNumber(counts.accepted),
      note: `${formatNumber(counts.duplicate)} were the same receipt twice`,
    },
    {
      key: 'confidence',
      label: 'How sure the reader has been',
      value: `${Number.isFinite(confidence) ? Math.round(confidence) : 0}%`,
      note:
        counts.failed > 0
          ? `${formatNumber(counts.failed)} could not be read at all`
          : 'Nothing has failed to read',
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
