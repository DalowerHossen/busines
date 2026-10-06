// src/components/reseller/reseller-stats.tsx
// The figures a white label partner opens with: accounts held, what they
// billed, and what the partner has earned on them.

import { Building2, Coins, HandCoins, PauseCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ResellerStatement } from '@/features/resellers/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface ResellerStatsProps {
  /** Figures for the last twelve months. */
  statement: ResellerStatement;
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
 * @param props The statement for this partner.
 * @returns The rendered strip.
 */
export function ResellerStats({ statement }: ResellerStatsProps) {
  const tiles: StatTile[] = [
    {
      key: 'accounts',
      label: 'Accounts you manage',
      value: formatNumber(statement.activeAccounts),
      hint: 'Live accounts billing through your brand',
      icon: Building2,
    },
    {
      key: 'suspended',
      label: 'Suspended accounts',
      value: formatNumber(statement.suspendedAccounts),
      hint: 'Paused by you, with their data untouched',
      icon: PauseCircle,
    },
    {
      key: 'retail',
      label: 'Billed in the last year',
      value: formatMoney(statement.retailTotal, statement.currency),
      hint: `${formatMoney(statement.wholesaleTotal, statement.currency)} of it is our wholesale price`,
      icon: Coins,
    },
    {
      key: 'commission',
      label: 'Your margin',
      value: formatMoney(statement.commissionEarned, statement.currency),
      hint: `${formatMoney(statement.commissionPending, statement.currency)} still to be confirmed`,
      icon: HandCoins,
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
