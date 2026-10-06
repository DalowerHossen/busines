// src/components/payouts/payout-table.tsx
// Payouts this business has asked for, and what happened to each of them.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { cancelPayout } from '@/features/payouts/actions/cancel-payout';
import type { PayoutRecord } from '@/features/payouts/types';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface PayoutTableProps {
  /** The payouts to show, newest first. */
  payouts: readonly PayoutRecord[];
  /** False when the signed in account may not call a payout off. */
  canCancel: boolean;
}

/** The states in which a payout can still be called off. */
const CANCELLABLE: readonly string[] = ['requested', 'under_review'];

/**
 * Renders the payout history.
 *
 * @param props The payouts and what the viewer may do.
 * @returns The rendered list.
 */
export function PayoutTable({ payouts, canCancel }: PayoutTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Calls off one payout.
   *
   * @param payout Payout being called off.
   * @returns Nothing.
   */
  async function callOff(payout: PayoutRecord): Promise<void> {
    setBusyId(payout.id);
    setFailure(null);

    const result = await cancelPayout({ payoutId: payout.id });
    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Payout called off and the money is back in your balance.');
    router.refresh();
  }

  if (payouts.length === 0) {
    return (
      <EmptyState
        title="No payout has been requested yet"
        description="When you ask for your balance to be sent out, every request appears here with what it cost and when it landed."
      />
    );
  }

  return (
    <div className="space-y-4">
      {failure ? (
        <Alert tone="danger" title="That payout was not changed">
          {failure}
        </Alert>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead isNumeric>Amount</TableHead>
              <TableHead isNumeric>Fee</TableHead>
              <TableHead isNumeric>You receive</TableHead>
              <TableHead>State</TableHead>
              <TableHead>
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell>{formatDateTime(payout.requestedAt)}</TableCell>
                <TableCell>
                  {payout.destinationLabel}
                  {payout.failureReason ? (
                    <span className="block text-sm text-destructive">{payout.failureReason}</span>
                  ) : null}
                  {payout.rejectionReason ? (
                    <span className="block text-sm text-muted-foreground">
                      {payout.rejectionReason}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell isNumeric>{formatMoney(payout.amount, payout.currency)}</TableCell>
                <TableCell isNumeric>{formatMoney(payout.feeAmount, payout.currency)}</TableCell>
                <TableCell isNumeric>{formatMoney(payout.netAmount, payout.currency)}</TableCell>
                <TableCell>
                  <StatusBadge kind="payout" status={payout.status} />
                </TableCell>
                <TableCell>
                  {canCancel && CANCELLABLE.includes(payout.status) ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        isLoading={busyId === payout.id}
                        loadingLabel="Cancelling"
                        onClick={() => {
                          void callOff(payout);
                        }}
                      >
                        Call it off
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {payouts.map((payout) => (
          <li key={payout.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{payout.destinationLabel}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(payout.requestedAt)}
                </p>
              </div>
              <StatusBadge kind="payout" status={payout.status} />
            </div>

            <p className="tabular mt-2 font-medium text-foreground">
              {formatMoney(payout.netAmount, payout.currency)} after a fee of{' '}
              {formatMoney(payout.feeAmount, payout.currency)}
            </p>

            {canCancel && CANCELLABLE.includes(payout.status) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                isLoading={busyId === payout.id}
                loadingLabel="Cancelling"
                onClick={() => {
                  void callOff(payout);
                }}
              >
                Call it off
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
