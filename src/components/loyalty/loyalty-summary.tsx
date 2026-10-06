// src/components/loyalty/loyalty-summary.tsx
// What the scheme has cost so far and what it still owes. Points are a debt
// until they are spent, so they are shown as money rather than as a score.

import { Card, CardContent } from '@/components/ui/card';
import type { LoyaltyOverview } from '@/features/loyalty/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface LoyaltySummaryProps {
  /** The figures to show. */
  overview: LoyaltyOverview;
  /** Currency the points are priced in. */
  currency: string;
}

/**
 * Renders the loyalty summary.
 *
 * @param props The figures and the currency.
 * @returns The rendered summary.
 */
export function LoyaltySummary({ overview, currency }: LoyaltySummaryProps) {
  const cards = [
    {
      key: 'members',
      label: 'Members',
      value: formatNumber(overview.memberCount),
      note: `${formatNumber(overview.topTierMembers)} of them are in the top two tiers`,
    },
    {
      key: 'points',
      label: 'Points not yet spent',
      value: formatNumber(overview.pointsOutstanding),
      note: 'Every point here is a promise still to keep',
    },
    {
      key: 'liability',
      label: 'What those points cost',
      value: formatMoney(overview.liabilityAmount, currency),
      note: 'Worth carrying in your accounts as money owed',
    },
    {
      key: 'claims',
      label: 'Rewards claimed',
      value: formatNumber(overview.rewardsClaimed),
      note: `${formatNumber(overview.rewardsWaiting)} have not been used yet`,
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
