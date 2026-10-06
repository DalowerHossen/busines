// src/components/payouts/wallet-summary.tsx
// What the platform holds for this business, split into what can be sent
// today, what is still inside the hold window and what is already on its way.

import { Card, CardContent } from '@/components/ui/card';
import type { WalletBalance } from '@/features/payouts/types';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface WalletSummaryProps {
  /** The wallet being summarised. */
  wallet: WalletBalance;
}

/**
 * Renders the wallet totals.
 *
 * @param props The wallet being summarised.
 * @returns The rendered summary.
 */
export function WalletSummary({ wallet }: WalletSummaryProps) {
  const tiles = [
    {
      key: 'available',
      label: 'Ready to send',
      value: formatMoney(wallet.availableBalance, wallet.currency),
      note: `Minimum payout ${formatMoney(wallet.payoutThreshold, wallet.currency)}`,
    },
    {
      key: 'pending',
      label: 'Still clearing',
      value: formatMoney(wallet.pendingBalance, wallet.currency),
      note: `Released after ${wallet.payoutHoldDays} day(s)`,
    },
    {
      key: 'reserved',
      label: 'On its way',
      value: formatMoney(wallet.reservedBalance, wallet.currency),
      note: 'Held against a payout already requested',
    },
    {
      key: 'lifetime',
      label: 'Received all time',
      value: formatMoney(wallet.lifetimeCredited, wallet.currency),
      note: wallet.lastPayoutAt
        ? `Last payout ${formatDateTime(wallet.lastPayoutAt)}`
        : 'No payout has been sent yet',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.key}>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p className="tabular mt-1 text-2xl font-semibold text-foreground">{tile.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tile.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
