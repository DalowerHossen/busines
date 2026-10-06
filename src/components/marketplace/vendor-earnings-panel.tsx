// src/components/marketplace/vendor-earnings-panel.tsx
// What the shop has earned. Money is held for a fortnight after each sale so
// refunds settle first, which is why pending and available are separate
// figures rather than one.

import { Clock, HandCoins, Package, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { VendorEarnings, VendorProfile } from '@/features/marketplace/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface VendorEarningsPanelProps {
  /** The vendor account. */
  profile: VendorProfile;
  /** What the account has earned, when the figures could be read. */
  earnings: VendorEarnings | null;
}

interface EarningsTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Renders the vendor figures.
 *
 * @param props The vendor account and its earnings.
 * @returns The rendered strip.
 */
export function VendorEarningsPanel({ profile, earnings }: VendorEarningsPanelProps) {
  const currency = earnings === null ? profile.payoutCurrency : earnings.currency;

  const tiles: EarningsTile[] = [
    {
      key: 'installs',
      label: 'Businesses running your work',
      value: formatNumber(profile.installCount),
      hint: `${formatNumber(profile.listingCount)} listings published`,
      icon: Package,
    },
    {
      key: 'pending',
      label: 'Held until the refund window closes',
      value: formatMoney(earnings === null ? '0' : earnings.pendingAmount, currency),
      hint: 'Released a fortnight after each sale',
      icon: Clock,
    },
    {
      key: 'available',
      label: 'Ready to be paid out',
      value: formatMoney(earnings === null ? '0' : earnings.availableAmount, currency),
      hint: 'Paid on the platform payout run',
      icon: Wallet,
    },
    {
      key: 'paid',
      label: 'Paid to you so far',
      value: formatMoney(earnings === null ? '0' : earnings.paidAmount, currency),
      hint: `You keep ${profile.revenueSharePercentage}% of every sale`,
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
