// src/components/admin/platform-stats.tsx
// The figures the platform console opens with: how many businesses are here,
// what they pay, what was collected and what is waiting to be looked at.

import {
  AlertTriangle,
  Banknote,
  Building2,
  CreditCard,
  ShieldQuestion,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PlatformOverview } from '@/features/admin/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface PlatformStatsProps {
  /** Figures read for the whole platform. */
  overview: PlatformOverview;
  /** Currency the platform reports in. */
  currency: string;
}

interface StatTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Renders the platform figures.
 *
 * @param props The overview and the reporting currency.
 * @returns The rendered strip.
 */
export function PlatformStats({ overview, currency }: PlatformStatsProps) {
  const tiles: StatTile[] = [
    {
      key: 'tenants',
      label: 'Businesses',
      value: formatNumber(overview.tenants.total),
      hint: `${formatNumber(overview.tenants.active)} active, ${formatNumber(
        overview.tenants.joinedThisMonth
      )} joined this month`,
      icon: Building2,
    },
    {
      key: 'paying',
      label: 'Paying plans',
      value: formatNumber(overview.subscriptions.paying),
      hint: `${formatNumber(overview.subscriptions.pastDue)} behind on payment`,
      icon: CreditCard,
    },
    {
      key: 'mrr',
      label: 'Monthly recurring revenue',
      value: formatMoney(overview.subscriptions.monthlyRecurringRevenue, currency),
      hint: 'Annual plans counted a twelfth at a time',
      icon: TrendingUp,
    },
    {
      key: 'collected',
      label: 'Collected this month',
      value: formatMoney(overview.money.collectedThisMonth, currency),
      hint: `${formatMoney(overview.money.platformFeesThisMonth, currency)} of it kept as fees`,
      icon: Banknote,
    },
    {
      key: 'kyc',
      label: 'Identity checks waiting',
      value: formatNumber(overview.accounts.awaitingKyc),
      hint: `${formatNumber(overview.money.payoutsAwaitingReview)} payouts to review`,
      icon: ShieldQuestion,
    },
    {
      key: 'attention',
      label: 'Needs attention',
      value: formatNumber(
        overview.attention.openDisputes + overview.attention.refundsAwaitingApproval
      ),
      hint: `${formatNumber(overview.attention.openDisputes)} disputes, ${formatNumber(
        overview.attention.refundsAwaitingApproval
      )} refunds to approve`,
      icon: AlertTriangle,
    },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
