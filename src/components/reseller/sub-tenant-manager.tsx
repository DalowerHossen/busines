// src/components/reseller/sub-tenant-manager.tsx
// The accounts a partner holds. Everything here is about the account as a
// commercial relationship: its name, its reference, what it has billed. What
// the account holds inside is never shown, because a partner has no right
// to it.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { provisionResellerAccount } from '@/features/resellers/actions/provision-account';
import { setResellerAccountStatus } from '@/features/resellers/actions/set-account-status';
import type { ResellerAccount } from '@/features/resellers/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface SubTenantManagerProps {
  /** Accounts this partner holds. */
  accounts: readonly ResellerAccount[];
  /** Currency the partner is billed in. */
  currency: string;
  /** False while the application is still being reviewed. */
  isApproved: boolean;
  /** Most accounts this partner may hold, when there is a ceiling. */
  maxAccounts: number | null;
}

/**
 * Renders the account list and the form that opens a new one.
 *
 * @param props Accounts, currency and the partner's limits.
 * @returns The rendered card.
 */
export function SubTenantManager({
  accounts,
  currency,
  isApproved,
  maxAccounts,
}: SubTenantManagerProps) {
  const router = useRouter();
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [accountReference, setAccountReference] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const isFull = maxAccounts !== null && accounts.length >= maxAccounts;

  /**
   * Opens a new account.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);

    const result = await provisionResellerAccount({
      legalName,
      displayName: displayName.length > 0 ? displayName : legalName,
      slug,
      accountReference,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    setLegalName('');
    setDisplayName('');
    setSlug('');
    setAccountReference('');
    notify.success('Account opened.');
    router.refresh();
  }

  /**
   * Suspends or restores one account.
   *
   * @param account Account being changed.
   * @param status State to put it in.
   * @returns Nothing.
   */
  async function onStatusChange(
    account: ResellerAccount,
    status: 'active' | 'suspended'
  ): Promise<void> {
    setBusyId(account.companyId);
    setFailure(null);

    const result = await setResellerAccountStatus({
      companyId: account.companyId,
      status,
      ...(status === 'suspended' ? { reason: 'Suspended by the partner' } : {}),
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(status === 'suspended' ? 'Account suspended.' : 'Account restored.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts you manage</CardTitle>
        <CardDescription>
          You open and bill these accounts. You cannot read the invoices, clients or documents
          inside them, and nothing here will ever show them to you.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {failure ? (
          <Alert tone="danger" title="That did not work">
            {failure}
          </Alert>
        ) : null}

        {accounts.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            description="Open the first one below and hand the login to your client."
          />
        ) : (
          <Table caption="Accounts managed under this partner">
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Your reference</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead isNumeric>Billed</TableHead>
                <TableHead isNumeric>Your margin</TableHead>
                <TableHead>
                  <span className="visually-hidden">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.companyId}>
                  <TableCell>{account.displayName}</TableCell>
                  <TableCell>{account.accountReference ?? 'None'}</TableCell>
                  <TableCell>
                    <Badge tone={account.status === 'active' ? 'success' : 'warning'}>
                      {humanise(account.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(account.provisionedAt)}</TableCell>
                  <TableCell isNumeric>
                    {formatMoney(account.lifetimeRetailAmount, currency)}
                  </TableCell>
                  <TableCell isNumeric>
                    {formatMoney(account.lifetimeCommissionAmount, currency)}
                  </TableCell>
                  <TableCell>
                    {account.status === 'released' ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isLoading={busyId === account.companyId}
                        loadingLabel="Saving"
                        onClick={() => {
                          void onStatusChange(
                            account,
                            account.status === 'active' ? 'suspended' : 'active'
                          );
                        }}
                      >
                        {account.status === 'active' ? 'Suspend' : 'Restore'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {isApproved && !isFull ? (
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-4" noValidate>
            <FormField id="account-legal-name" label="Registered name">
              <Input
                {...fieldAccessibilityProps('account-legal-name', false, false)}
                value={legalName}
                onChange={(event) => {
                  setLegalName(event.target.value);
                }}
              />
            </FormField>

            <FormField id="account-display-name" label="Trading name">
              <Input
                {...fieldAccessibilityProps('account-display-name', false, false)}
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                }}
              />
            </FormField>

            <FormField id="account-slug" label="Address">
              <Input
                {...fieldAccessibilityProps('account-slug', false, false)}
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value.toLowerCase());
                }}
              />
            </FormField>

            <FormField id="account-reference" label="Your reference">
              <Input
                {...fieldAccessibilityProps('account-reference', false, false)}
                value={accountReference}
                onChange={(event) => {
                  setAccountReference(event.target.value);
                }}
              />
            </FormField>

            <div className="md:col-span-4">
              <Button type="submit" isLoading={isSaving} loadingLabel="Opening">
                Open account
              </Button>
            </div>
          </form>
        ) : null}

        {isApproved && isFull ? (
          <Alert tone="warning" title="You have reached your account limit">
            Your agreement allows {maxAccounts} accounts. Write to support to raise it.
          </Alert>
        ) : null}

        {isApproved ? null : (
          <Alert tone="info" title="Accounts open up once you are approved">
            We review every partner application by hand, usually within two working days.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
