// src/components/payouts/settlement-summary-card.tsx
// What the platform is holding for this business, and on what terms.
//
// Three numbers decide whether a seller trusts a platform like this: how
// much is theirs, when they can have it, and what it cost them to collect
// it. All three are on this card, in that order, with nothing hidden behind
// a help article.

import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SettlementSummary } from '@/features/settlements/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface SettlementSummaryCardProps {
  /** The totals as the database reported them. */
  summary: SettlementSummary;
}

/**
 * Renders the settlement summary.
 *
 * @param props The totals.
 * @returns The rendered card.
 */
export function SettlementSummaryCard({ summary }: SettlementSummaryCardProps) {
  const tiles = [
    {
      label: 'Ready to withdraw',
      value: formatMoney(summary.availableAmount, summary.currency),
      note: `Withdrawals of ${formatMoney(summary.payoutThreshold, summary.currency)} or more.`,
    },
    {
      label: 'Still on hold',
      value: formatMoney(summary.heldAmount, summary.currency),
      note:
        summary.nextReleaseDate === null
          ? 'Nothing is waiting.'
          : `Next release ${formatDate(summary.nextReleaseDate)}.`,
    },
    {
      label: 'Already sent to you',
      value: formatMoney(summary.paidOutAmount, summary.currency),
      note: 'Across every withdrawal so far.',
    },
    {
      label: 'Collection costs',
      value: formatMoney(summary.feesPaid, summary.currency),
      note: 'Card charges and our fee together.',
    },
  ];

  return (
    <div className="space-y-4">
      {summary.isFrozen ? (
        <Alert tone="danger" title="Withdrawals are paused on this account">
          Your balance is safe. Write to support and we will tell you exactly what is needed to lift
          the pause.
        </Alert>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="space-y-1 pt-6">
              <dt className="text-sm text-muted-foreground">{tile.label}</dt>
              <dd className="tabular text-2xl font-semibold">{tile.value}</dd>
              <p className="text-sm text-muted-foreground">{tile.note}</p>
            </CardContent>
          </Card>
        ))}
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Your collection terms</CardTitle>
          <CardDescription>
            These are the terms your account is on right now. They are applied to every payment
            before the money reaches your balance, and each payment shows its own breakdown below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 text-sm sm:grid-cols-3">
            <li>
              <span className="block text-muted-foreground">Our fee</span>
              <span className="tabular font-medium">
                {`${formatNumber(summary.feePercentage, 2)}% of each payment, minimum ${formatMoney(
                  summary.minimumFee,
                  summary.currency
                )}`}
              </span>
            </li>
            <li>
              <span className="block text-muted-foreground">Hold period</span>
              <span className="tabular font-medium">
                {summary.holdDays === 0
                  ? 'Available immediately'
                  : `${formatNumber(summary.holdDays)} days after the client pays`}
              </span>
            </li>
            <li>
              <span className="block text-muted-foreground">Withdrawal promise</span>
              <span className="tabular font-medium">
                {`Sent within ${formatNumber(summary.payoutSlaHours)} hours of your request`}
              </span>
            </li>
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">
            Whatever the card network and the collecting partner charge is shown separately on each
            payment, because it is their charge rather than ours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
