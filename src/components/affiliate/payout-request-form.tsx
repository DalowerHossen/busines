// src/components/affiliate/payout-request-form.tsx
// Asking for the money. The amount leaves the available balance the moment
// it is requested, so the same earnings can never be asked for twice.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
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
import { requestAffiliatePayout } from '@/features/affiliates/actions/request-affiliate-payout';
import type { AffiliatePayout } from '@/features/affiliates/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface PayoutRequestFormProps {
  /** Amount ready to be paid out. */
  availableAmount: string;
  /** Least that may be requested at once. */
  minimumAmount: string;
  /** Currency the partner is paid in. */
  currency: string;
  /** Payouts already requested. */
  payouts: readonly AffiliatePayout[];
  /** False while the application is still being reviewed. */
  isApproved: boolean;
}

/**
 * Renders the payout request and its history.
 *
 * @param props Balances, currency and past payouts.
 * @returns The rendered card.
 */
export function PayoutRequestForm({
  availableAmount,
  minimumAmount,
  currency,
  payouts,
  isApproved,
}: PayoutRequestFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(availableAmount);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Sends the payout request.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);

    const result = await requestAffiliatePayout({ amount });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Your payout is on its way to review.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting paid</CardTitle>
        <CardDescription>
          {formatMoney(availableAmount, currency)} is ready. Payouts are reviewed by our team and
          usually sent within three working days.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {failure ? (
          <Alert tone="danger" title="That payout was not requested">
            {failure}
          </Alert>
        ) : null}

        {isApproved ? (
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
            <FormField
              id="payout-amount"
              label="Amount"
              hint={`Minimum ${formatMoney(minimumAmount, currency)}`}
              className="w-full max-w-xs"
            >
              <Input
                {...fieldAccessibilityProps('payout-amount', true, false)}
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                }}
              />
            </FormField>

            <Button type="submit" isLoading={isSaving} loadingLabel="Requesting">
              Request payout
            </Button>
          </form>
        ) : (
          <Alert tone="info" title="Payouts start after approval">
            Earnings build up from the day you are approved, and you can withdraw them from here.
          </Alert>
        )}

        {payouts.length === 0 ? (
          <EmptyState
            title="No payouts yet"
            description="Your payout history will be listed here, with the fee on each one."
          />
        ) : (
          <Table caption="Payouts requested">
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>State</TableHead>
                <TableHead isNumeric>Fee</TableHead>
                <TableHead isNumeric>You receive</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell>{formatDate(payout.requestedAt)}</TableCell>
                  <TableCell>{payout.payoutNumber ?? 'Not issued yet'}</TableCell>
                  <TableCell>
                    <StatusBadge kind="payout" status={payout.status} />
                  </TableCell>
                  <TableCell isNumeric>{formatMoney(payout.feeAmount, payout.currency)}</TableCell>
                  <TableCell isNumeric>{formatMoney(payout.netAmount, payout.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
