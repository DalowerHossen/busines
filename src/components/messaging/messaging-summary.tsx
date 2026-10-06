// src/components/messaging/messaging-summary.tsx
// Reach, consent, chains in flight and spend, in four figures, so the page
// opens with an answer rather than a table.

import { Card, CardContent } from '@/components/ui/card';
import type { MessagingOverview } from '@/features/messaging/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface MessagingSummaryProps {
  /** The figures to show. */
  overview: MessagingOverview;
  /** Currency the spend is counted in. */
  currency: string;
}

/**
 * Renders the messaging summary.
 *
 * @param props The figures and the currency.
 * @returns The rendered summary.
 */
export function MessagingSummary({ overview, currency }: MessagingSummaryProps) {
  const cards = [
    {
      key: 'channels',
      label: 'Channels ready to use',
      value: formatNumber(overview.verifiedChannels),
      note: `${formatNumber(overview.activeChannels)} switched on`,
    },
    {
      key: 'reach',
      label: 'People who agreed to be reached',
      value: formatNumber(overview.reachablePeople),
      note: `${formatNumber(overview.optedOutPeople)} have asked us to stop`,
    },
    {
      key: 'chains',
      label: 'Chains running now',
      value: formatNumber(overview.runningRoutes),
      note: `${formatNumber(overview.deliveredRoutes)} landed, ${formatNumber(
        overview.exhaustedRoutes
      )} ran out of channels`,
    },
    {
      key: 'spend',
      label: 'Spent in the last thirty days',
      value: formatMoney(overview.spendLast30Days, currency),
      note: `${formatNumber(overview.unhandledReplies)} replies waiting for somebody`,
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
