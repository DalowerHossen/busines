// src/components/messaging/outbox-summary.tsx
// The figures above the outbox: what is waiting, what went out and what needs
// attention.

import { Card, CardContent } from '@/components/ui/card';
import type { OutboxTotals } from '@/features/messaging/types';

export interface OutboxSummaryProps {
  /** The figures to show. */
  totals: OutboxTotals;
}

/**
 * Renders the outbox figures.
 *
 * @param props The figures to show.
 * @returns The rendered strip.
 */
export function OutboxSummary({ totals }: OutboxSummaryProps) {
  const cards = [
    { key: 'queued', label: 'Waiting to go out', value: totals.queued },
    { key: 'sent', label: 'Delivered recently', value: totals.sent },
    { key: 'failed', label: 'Needs attention', value: totals.failed },
    { key: 'requests', label: 'Awaiting your approval', value: totals.pendingRequests },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="tabular mt-1 text-2xl font-semibold text-foreground">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
