// src/components/payments/payment-rail-panel.tsx
// The global rails: Adyen, which can pay each business into its own balance
// account, and Nium, which sends money out to bank accounts and wallets in
// most countries. The keys live on the connection above; this panel holds
// the identifiers the provider issued during onboarding.

'use client';

import { RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { connectPaymentRail } from '@/features/payouts/actions/connect-payment-rail';
import { refreshPaymentRail } from '@/features/payouts/actions/refresh-payment-rail';
import type { PaymentRailAccount } from '@/features/payouts/types';
import { formatDateTime } from '@/lib/dates';

export interface PaymentRailPanelProps {
  /** The rail connections this business already has. */
  accounts: readonly PaymentRailAccount[];
  /** False when the signed in account may only read. */
  canManage: boolean;
  /** Currency the business keeps its books in. */
  baseCurrency: string;
  /** Country the business is registered in. */
  countryCode: string;
}

const RAIL_OPTIONS = [
  { value: 'adyen', label: 'Adyen — take cards into a balance account' },
  { value: 'nium', label: 'Nium — send money out across borders' },
];

const MODE_OPTIONS = [
  { value: 'test', label: 'Test — nothing real moves' },
  { value: 'live', label: 'Live — real money moves' },
];

const RAIL_LABELS: Readonly<Record<'adyen' | 'nium', string>> = {
  adyen: 'Adyen',
  nium: 'Nium',
};

const STATUS_TONES: Readonly<
  Record<PaymentRailAccount['status'], 'neutral' | 'success' | 'warning' | 'danger'>
> = {
  pending: 'neutral',
  onboarding: 'warning',
  active: 'success',
  restricted: 'warning',
  suspended: 'danger',
  closed: 'neutral',
};

const STATUS_LABELS: Readonly<Record<PaymentRailAccount['status'], string>> = {
  pending: 'Not started',
  onboarding: 'Waiting on the provider',
  active: 'Working',
  restricted: 'Limited by the provider',
  suspended: 'Suspended',
  closed: 'Closed',
};

/**
 * Renders the global payment rails of one business.
 *
 * @param props The connections and what the viewer may do.
 * @returns The rendered panel.
 */
export function PaymentRailPanel({
  accounts,
  canManage,
  baseCurrency,
  countryCode,
}: PaymentRailPanelProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [rail, setRail] = useState<'adyen' | 'nium'>('adyen');
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [accountHolder, setAccountHolder] = useState('');
  const [balanceAccount, setBalanceAccount] = useState('');
  const [wallet, setWallet] = useState('');
  const [feePercentage, setFeePercentage] = useState('0');
  const [isWorking, setIsWorking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  /**
   * Saves a connection and asks the provider whether it is usable.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsWorking(true);
    setPanelError(null);

    const result = await connectPaymentRail({
      rail,
      mode,
      accountHolderReference: accountHolder,
      balanceAccountReference: balanceAccount,
      walletReference: wallet,
      defaultCurrency: baseCurrency,
      countryCode,
      platformFeePercentage: Number.parseFloat(feePercentage) || 0,
    });

    setIsWorking(false);

    if (!result.success) {
      setPanelError(result.error);
      return;
    }

    if (result.data.status === 'active') {
      notify.success(result.data.message);
    } else {
      notify.error(result.data.message);
    }

    setIsFormOpen(false);
    setAccountHolder('');
    setBalanceAccount('');
    setWallet('');
    router.refresh();
  }

  /**
   * Asks the provider again what state one connection is in.
   *
   * @param account Connection to check.
   * @returns Nothing.
   */
  async function refresh(account: PaymentRailAccount): Promise<void> {
    setBusyId(account.id);
    setPanelError(null);

    const result = await refreshPaymentRail({ accountId: account.id });
    setBusyId(null);

    if (!result.success) {
      setPanelError(result.error);
      return;
    }

    if (result.data.status === 'active') {
      notify.success(result.data.message);
    } else {
      notify.error(result.data.message);
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global rails</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Adyen pays each business into its own balance account, so the money never sits with
          anybody else. Nium sends money out to bank accounts and wallets in over a hundred
          currencies. Save the keys above first, then connect the account the provider gave you.
        </p>

        {panelError ? (
          <Alert tone="danger" title="That did not work">
            {panelError}
          </Alert>
        ) : null}

        {canManage ? (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsFormOpen(true)}>
              Connect a rail
            </Button>
          </div>
        ) : null}

        {accounts.length === 0 ? (
          <EmptyState
            title="No global rail is connected"
            description="Connect Adyen to take cards into your own balance account, or Nium to pay people in other countries."
          />
        ) : (
          <ul className="space-y-3">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="rounded-lg border border-border bg-surface-raised p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{RAIL_LABELS[account.rail]}</span>
                      <Badge tone={STATUS_TONES[account.status]}>
                        {STATUS_LABELS[account.status]}
                      </Badge>
                      <Badge tone="neutral">{account.mode === 'live' ? 'Live' : 'Test'}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.rail === 'adyen'
                        ? `Balance account ${account.balanceAccountReference ?? 'not set'} · ${account.platformFeePercentage}% platform share`
                        : `Funding wallet ${account.walletReference ?? 'not set'} · ${account.defaultCurrency}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {account.isReceivingEnabled ? 'Can take money. ' : 'Cannot take money yet. '}
                      {account.isSendingEnabled ? 'Can send money.' : 'Cannot send money yet.'}
                    </p>
                    {account.lastSyncedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Last checked {formatDateTime(account.lastSyncedAt)}
                      </p>
                    ) : null}
                    {account.lastError ? (
                      <p className="text-danger-600 text-xs">{account.lastError}</p>
                    ) : null}
                  </div>

                  {canManage ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isLoading={busyId === account.id}
                      loadingLabel="Checking"
                      leadingIcon={<RefreshCcw aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => {
                        void refresh(account);
                      }}
                    >
                      Check again
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Connect a global rail"
        description="Enter the identifiers the provider gave you when your account was opened."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField id="rail" label="Rail" isRequired>
            <Select
              options={RAIL_OPTIONS}
              value={rail}
              onChange={(event) => setRail(event.target.value === 'nium' ? 'nium' : 'adyen')}
              {...fieldAccessibilityProps('rail', false, false)}
            />
          </FormField>

          <FormField id="rail-mode" label="Mode" isRequired>
            <Select
              options={MODE_OPTIONS}
              value={mode}
              onChange={(event) => setMode(event.target.value === 'live' ? 'live' : 'test')}
              {...fieldAccessibilityProps('rail-mode', false, false)}
            />
          </FormField>

          {rail === 'adyen' ? (
            <>
              <FormField
                id="account-holder"
                label="Account holder"
                hint="Starts with AH and is shown on the account holder page in Adyen."
              >
                <Input
                  value={accountHolder}
                  onChange={(event) => setAccountHolder(event.target.value)}
                  {...fieldAccessibilityProps('account-holder', true, false)}
                />
              </FormField>

              <FormField
                id="balance-account"
                label="Balance account"
                hint="Starts with BA. This is the balance your payments land in."
              >
                <Input
                  value={balanceAccount}
                  onChange={(event) => setBalanceAccount(event.target.value)}
                  {...fieldAccessibilityProps('balance-account', true, false)}
                />
              </FormField>

              <FormField
                id="platform-share"
                label="Platform share"
                hint="The percentage split off to the platform when a payment is taken."
              >
                <Input
                  type="number"
                  min="0"
                  max="30"
                  step="0.01"
                  value={feePercentage}
                  onChange={(event) => setFeePercentage(event.target.value)}
                  {...fieldAccessibilityProps('platform-share', true, false)}
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField
                id="customer-reference"
                label="Customer"
                hint="The customer identifier Nium created for this business."
              >
                <Input
                  value={accountHolder}
                  onChange={(event) => setAccountHolder(event.target.value)}
                  {...fieldAccessibilityProps('customer-reference', true, false)}
                />
              </FormField>

              <FormField
                id="wallet-reference"
                label="Funding wallet"
                hint="The wallet payouts are taken from."
              >
                <Input
                  value={wallet}
                  onChange={(event) => setWallet(event.target.value)}
                  {...fieldAccessibilityProps('wallet-reference', true, false)}
                />
              </FormField>
            </>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isWorking} loadingLabel="Saving">
              Save and check
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
