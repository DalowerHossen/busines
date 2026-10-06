// src/components/payouts/payout-account-manager.tsx
// The places this business can be paid into: a bank account, bKash, Nagad or
// PayPal. The number itself is never shown again once it has been saved.

'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { savePayoutAccount } from '@/features/payouts/actions/save-payout-account';
import type { PayoutAccount } from '@/features/payouts/types';
import { humanise } from '@/lib/format';

export interface PayoutAccountManagerProps {
  /** Destinations already saved. */
  accounts: readonly PayoutAccount[];
  /** Currency of the wallet, used as the default for a new destination. */
  currency: string;
  /** Country of the business, used as the default for a new destination. */
  countryCode: string;
  /** False when the signed in account may only read. */
  canEdit: boolean;
}

const METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'wallet_credit', label: 'Keep it as credit on the platform' },
];

/**
 * Renders the list of payout destinations and the form to add one.
 *
 * @param props The destinations and what the viewer may do.
 * @returns The rendered manager.
 */
export function PayoutAccountManager({
  accounts,
  currency,
  countryCode,
  canEdit,
}: PayoutAccountManagerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [holder, setHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [makeDefault, setMakeDefault] = useState(accounts.length === 0);
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const isBank = method === 'bank_transfer';

  /**
   * Saves the destination.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsWorking(true);
    setFailure(null);

    const result = await savePayoutAccount({
      label,
      method:
        method === 'bkash'
          ? 'bkash'
          : method === 'nagad'
            ? 'nagad'
            : method === 'paypal'
              ? 'paypal'
              : method === 'wallet_credit'
                ? 'wallet_credit'
                : 'bank_transfer',
      accountHolderName: holder,
      accountNumber,
      bankName,
      routingNumber,
      currency,
      countryCode,
      makeDefault,
    });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Destination saved. Only the last four characters are kept readable.');
    setIsOpen(false);
    setLabel('');
    setHolder('');
    setAccountNumber('');
    setBankName('');
    setRoutingNumber('');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where your money goes</CardTitle>
        <CardDescription>
          Account numbers are encrypted the moment they are saved. Nobody, including our team, can
          read them back.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No destination has been saved yet, so there is nowhere to send a payout.
          </p>
        ) : (
          <ul className="space-y-3">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4"
              >
                <div>
                  <p className="font-medium text-foreground">{account.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {humanise(account.method)} · {account.accountHolderName}
                    {account.accountMask ? ` · ${account.accountMask}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {account.isDefault ? <Badge tone="info">Used by default</Badge> : null}
                  <Badge tone={account.isVerified ? 'success' : 'warning'}>
                    {account.isVerified ? 'Verified' : 'Not verified yet'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <Button
            type="button"
            variant="secondary"
            leadingIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              setIsOpen(true);
            }}
          >
            Add a destination
          </Button>
        ) : null}
      </CardContent>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
        title="Add a payout destination"
        description="Make sure the name matches the account exactly, or the bank will send the money back."
        size="lg"
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          {failure ? (
            <Alert tone="danger" title="The destination was not saved">
              {failure}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="destination-label" label="What you call it" isRequired>
              <Input
                {...fieldAccessibilityProps('destination-label', false, false)}
                value={label}
                placeholder="Business current account"
                disabled={isWorking}
                onChange={(event) => {
                  setLabel(event.target.value);
                }}
              />
            </FormField>

            <FormField id="destination-method" label="How it is paid">
              <Select
                id="destination-method"
                options={METHOD_OPTIONS}
                value={method}
                disabled={isWorking}
                onChange={(event) => {
                  setMethod(event.target.value);
                }}
              />
            </FormField>

            <FormField id="destination-holder" label="Name on the account" isRequired>
              <Input
                {...fieldAccessibilityProps('destination-holder', false, false)}
                value={holder}
                disabled={isWorking}
                onChange={(event) => {
                  setHolder(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="destination-number"
              label={isBank ? 'Account number' : 'Wallet or account number'}
              hint="Stored encrypted. Only the last four characters stay readable."
              isRequired
            >
              <Input
                {...fieldAccessibilityProps('destination-number', true, false)}
                value={accountNumber}
                autoComplete="off"
                disabled={isWorking}
                onChange={(event) => {
                  setAccountNumber(event.target.value);
                }}
              />
            </FormField>

            {isBank ? (
              <>
                <FormField id="destination-bank" label="Bank name">
                  <Input
                    {...fieldAccessibilityProps('destination-bank', false, false)}
                    value={bankName}
                    disabled={isWorking}
                    onChange={(event) => {
                      setBankName(event.target.value);
                    }}
                  />
                </FormField>

                <FormField
                  id="destination-routing"
                  label="Routing, sort code or SWIFT"
                  hint="Whatever your bank uses to receive money from abroad."
                >
                  <Input
                    {...fieldAccessibilityProps('destination-routing', true, false)}
                    value={routingNumber}
                    disabled={isWorking}
                    onChange={(event) => {
                      setRoutingNumber(event.target.value);
                    }}
                  />
                </FormField>
              </>
            ) : null}
          </div>

          <Checkbox
            label="Send payouts here by default"
            checked={makeDefault}
            disabled={isWorking}
            onChange={(event) => {
              setMakeDefault(event.target.checked);
            }}
          />

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={isWorking}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isWorking} loadingLabel="Saving">
              Save destination
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
