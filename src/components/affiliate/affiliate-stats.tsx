// src/components/affiliate/affiliate-stats.tsx
// The figures a referral partner opens the portal with: traffic sent,
// accounts opened, money waiting and money ready.

import { Clock, MousePointerClick, UserPlus, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { AffiliateSummary } from '@/features/affiliates/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface AffiliateStatsProps {
  /** Figures read for this partner. */
  summary: AffiliateSummary;
}

interface StatTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Renders the partner figures.
 *
 * @param props The summary for this partner.
 * @returns The rendered strip.
 */
export function AffiliateStats({ summary }: AffiliateStatsProps) {
  const tiles: StatTile[] = [
    {
      key: 'clicks',
      label: 'Visits in the last thirty days',
      value: formatNumber(summary.clicksLast30Days),
      hint: `${formatNumber(summary.clicksTotal)} since you joined`,
      icon: MousePointerClick,
    },
    {
      key: 'signups',
      label: 'Accounts opened',
      value: formatNumber(summary.signupsTotal),
      hint: 'Counted when a business completes signup through your link',
      icon: UserPlus,
    },
    {
      key: 'pending',
      label: 'Earned, not yet released',
      value: formatMoney(summary.pendingAmount, summary.payoutCurrency),
      hint: 'Held until the refund window on the payment has passed',
      icon: Clock,
    },
    {
      key: 'available',
      label: 'Ready to pay out',
      value: formatMoney(summary.walletAvailable, summary.payoutCurrency),
      hint: `Minimum payout ${formatMoney(summary.minimumPayoutAmount, summary.payoutCurrency)}`,
      icon: Wallet,
    },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <tile.icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">{tile.label}</dt>
              <dd className="tabular truncate text-xl font-semibold text-foreground">
                {tile.value}
              </dd>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tile.hint}</p>
        </div>
      ))}
    </dl>
  );
}
