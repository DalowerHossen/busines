// src/components/payouts/payout-request-panel.tsx
// Asking for the balance to be sent to a destination that has been saved.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { requestPayout } from '@/features/payouts/actions/request-payout';
import type { PayoutAccount, WalletBalance } from '@/features/payouts/types';
import { formatMoney } from '@/lib/format';

export interface PayoutRequestPanelProps {
  /** The wallet the money would come from. */
  wallet: WalletBalance;
  /** Destinations the money can be sent to. */
  accounts: readonly PayoutAccount[];
  /** False when the signed in account may only read. */
  canRequest: boolean;
}

/**
 * Renders the payout request form.
 *
 * @param props The wallet, its destinations and what the viewer may do.
 * @returns The rendered panel.
 */
export function PayoutRequestPanel({ wallet, accounts, canRequest }: PayoutRequestPanelProps) {
  const router = useRouter();
  const defaultAccount = accounts.find((account) => account.isDefault) ?? accounts[0];
  const [accountId, setAccountId] = useState(defaultAccount?.id ?? '');
  const [amount, setAmount] = useState(wallet.availableBalance);
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const belowThreshold =
    Number.parseFloat(wallet.availableBalance) < Number.parseFloat(wallet.payoutThreshold);

  /**
   * Sends the payout request.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsWorking(true);
    setFailure(null);

    const result = await requestPayout({ amount, accountId });
    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Payout requested. The amount is held until the transfer is confirmed.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send money to your account</CardTitle>
        <CardDescription>
          {formatMoney(wallet.availableBalance, wallet.currency)} is available today. Money stays
          pending for {wallet.payoutHoldDays} day(s) after a client pays, so it can still be
          refunded without leaving you short.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {wallet.isFrozen ? (
          <Alert tone="danger" title="This wallet is on hold">
            {wallet.frozenReason ?? 'Write to support and we will explain what is needed.'}
          </Alert>
        ) : null}

        {!wallet.isPayoutEnabled && !wallet.isFrozen ? (
          <Alert tone="warning" title="Payouts are switched off for this wallet">
            Finish your identity checks and payouts are opened again.
          </Alert>
        ) : null}

        {accounts.length === 0 ? (
          <Alert tone="info" title="Add a destination first">
            Save a bank account or mobile wallet below and you can request a payout straight away.
          </Alert>
        ) : null}

        {failure ? (
          <Alert tone="danger" title="The payout was not requested">
            {failure}
          </Alert>
        ) : null}

        {belowThreshold ? (
          <Alert tone="info" title="Below the minimum for now">
            Payouts start at {formatMoney(wallet.payoutThreshold, wallet.currency)}, which keeps
            transfer charges sensible. Your balance keeps building until then.
          </Alert>
        ) : null}

        {canRequest && accounts.length > 0 ? (
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="payout-amount"
                label="Amount to send"
                hint={`Between ${wallet.payoutThreshold} and ${wallet.availableBalance}.`}
                isRequired
              >
                <Input
                  {...fieldAccessibilityProps('payout-amount', true, false)}
                  type="number"
                  step="0.01"
                  min={wallet.payoutThreshold}
                  max={wallet.availableBalance}
                  value={amount}
                  disabled={isWorking || belowThreshold}
                  onChange={(event) => {
                    setAmount(event.target.value);
                  }}
                />
              </FormField>

              <FormField id="payout-account" label="Where it should go">
                <Select
                  id="payout-account"
                  value={accountId}
                  disabled={isWorking}
                  options={accounts.map((account) => ({
                    value: account.id,
                    label: `${account.label}${account.accountMask ? ` (${account.accountMask})` : ''}`,
                  }))}
                  onChange={(event) => {
                    setAccountId(event.target.value);
                  }}
                />
              </FormField>
            </div>

            <Button
              type="submit"
              isLoading={isWorking}
              loadingLabel="Requesting"
              disabled={belowThreshold || wallet.isFrozen || !wallet.isPayoutEnabled}
            >
              Request this payout
            </Button>
          </form>
        ) : null}

        {canRequest ? null : (
          <Alert tone="info" title="Only the owner can move this money">
            Ask the owner of this business to request the payout.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
