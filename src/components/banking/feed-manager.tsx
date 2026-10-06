// src/components/banking/feed-manager.tsx
// The connections themselves: how fresh each one is, how long its consent
// has left, which of your accounts it feeds, and how to end it.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { linkFeedAccount } from '@/features/banking/actions/link-feed-account';
import { disconnectFeed, setFeedFrequency } from '@/features/banking/actions/manage-feed';
import type {
  FeedAccountRecord,
  FeedConnectionHealth,
  LedgerBankAccountOption,
} from '@/features/banking/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface FeedManagerProps {
  /** The connections and their health. */
  connections: readonly FeedConnectionHealth[];
  /** The accounts the aggregator reported. */
  accounts: readonly FeedAccountRecord[];
  /** The accounts in our own books a feed can point at. */
  ledgerAccounts: readonly LedgerBankAccountOption[];
  /** False when the viewer may look but not change anything. */
  canManage: boolean;
}

/**
 * Picks the tone that matches the state of a connection.
 *
 * @param status Status recorded on the connection.
 * @returns The tone of the badge.
 */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active') {
    return 'success';
  }

  if (status === 'reauthorization_required' || status === 'pending') {
    return 'warning';
  }

  if (status === 'error' || status === 'expired') {
    return 'danger';
  }

  return 'neutral';
}

/**
 * Renders the connection manager.
 *
 * @param props The connections, the accounts and what the viewer may do.
 * @returns The rendered manager.
 */
export function FeedManager({
  connections,
  accounts,
  ledgerAccounts,
  canManage,
}: FeedManagerProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const options = ledgerAccounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${account.currency})`,
  }));

  /**
   * Points one feed account at an account in our books.
   *
   * @param account Feed account being linked.
   * @returns Nothing.
   */
  async function onLink(account: FeedAccountRecord): Promise<void> {
    const target = chosen[account.feedAccountId] ?? account.bankAccountId ?? '';

    if (!target) {
      setFailure('Choose which of your accounts this feed describes.');

      return;
    }

    setBusyId(account.feedAccountId);
    setFailure(null);

    const result = await linkFeedAccount({
      feedAccountId: account.feedAccountId,
      bankAccountId: target,
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That feed now writes into the right account.');
    router.refresh();
  }

  /**
   * Changes how often one connection is read.
   *
   * @param connection Connection being changed.
   * @param hours Hours between reads.
   * @returns Nothing.
   */
  async function onFrequency(connection: FeedConnectionHealth, hours: number): Promise<void> {
    setBusyId(connection.connectionId);
    setFailure(null);

    const result = await setFeedFrequency({
      connectionId: connection.connectionId,
      syncFrequencyHours: hours,
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(`${connection.institutionName} will be read every ${hours} hours.`);
    router.refresh();
  }

  /**
   * Ends one connection.
   *
   * @param connection Connection being ended.
   * @returns Nothing.
   */
  async function onDisconnect(connection: FeedConnectionHealth): Promise<void> {
    const reason = reasons[connection.connectionId] ?? '';

    if (reason.trim().length < 3) {
      setFailure('Say why the connection is being ended.');

      return;
    }

    setBusyId(connection.connectionId);
    setFailure(null);

    const result = await disconnectFeed({
      connectionId: connection.connectionId,
      reason,
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That connection has been ended and its tokens discarded.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Banks you are connected to</CardTitle>
          <CardDescription>
            Consent to read an account runs out on a date set by the bank, not by us. You are warned
            here well before it lapses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connections.length === 0 ? (
            <EmptyState
              title="No bank is connected yet"
              description="Until one is, statement lines can still be brought in from a file and reconciled exactly the same way."
            />
          ) : (
            connections.map((connection) => (
              <div
                key={connection.connectionId}
                className="space-y-3 rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{connection.institutionName}</p>
                      <Badge tone={statusTone(connection.status)}>
                        {humanise(connection.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {connection.lastSyncedAt === null
                        ? 'Not read yet'
                        : `Last read ${formatDateTime(connection.lastSyncedAt)}`}
                      {connection.consentExpiresAt
                        ? ` · consent runs out ${formatDate(connection.consentExpiresAt)}`
                        : ''}
                    </p>
                    {connection.daysUntilExpiry !== null && connection.daysUntilExpiry <= 14 ? (
                      <p className="text-sm text-warning">
                        Consent ends in {formatNumber(connection.daysUntilExpiry)} days. Renew it
                        with your bank before the feed stops.
                      </p>
                    ) : null}
                    {connection.consecutiveFailures > 0 ? (
                      <p className="text-danger text-sm">
                        The last {formatNumber(connection.consecutiveFailures)} attempts to read
                        this bank failed.
                      </p>
                    ) : null}
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        aria-label={`How often ${connection.institutionName} is read`}
                        options={[
                          { value: '1', label: 'Every hour' },
                          { value: '6', label: 'Every six hours' },
                          { value: '12', label: 'Twice a day' },
                          { value: '24', label: 'Once a day' },
                          { value: '168', label: 'Once a week' },
                        ]}
                        defaultValue="12"
                        onChange={(event) => {
                          void onFrequency(connection, Number(event.target.value));
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      aria-label={`Why the connection to ${connection.institutionName} is ending`}
                      placeholder="Reason for ending this connection"
                      value={reasons[connection.connectionId] ?? ''}
                      onChange={(event) => {
                        setReasons((state) => ({
                          ...state,
                          [connection.connectionId]: event.target.value,
                        }));
                      }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      isLoading={busyId === connection.connectionId}
                      loadingLabel="Ending"
                      onClick={() => {
                        void onDisconnect(connection);
                      }}
                    >
                      End connection
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts the bank reported</CardTitle>
          <CardDescription>
            Nothing is imported from an account until you say which of your own accounts it is.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 ? (
            <EmptyState
              title="No accounts have been reported"
              description="Once a bank is connected, every account it lets us see appears here."
            />
          ) : (
            accounts.map((account) => (
              <div
                key={account.feedAccountId}
                className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{account.accountName}</p>
                    {account.accountMask ? (
                      <Badge tone="neutral">Ending {account.accountMask}</Badge>
                    ) : null}
                    <Badge tone={account.isLinked ? 'success' : 'warning'}>
                      {account.isLinked ? 'Mapped' : 'Not mapped yet'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {account.institutionName}
                    {account.currentBalance
                      ? ` · ${formatMoney(account.currentBalance, account.currency)}`
                      : ''}
                    {account.bankAccountName ? ` · feeds ${account.bankAccountName}` : ''}
                    {account.lastTransactionDate
                      ? ` · latest line ${formatDate(account.lastTransactionDate)}`
                      : ''}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label={`Which of our accounts ${account.accountName} is`}
                      options={options}
                      placeholder="Choose an account"
                      value={chosen[account.feedAccountId] ?? account.bankAccountId ?? ''}
                      onChange={(event) => {
                        setChosen((state) => ({
                          ...state,
                          [account.feedAccountId]: event.target.value,
                        }));
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      isLoading={busyId === account.feedAccountId}
                      loadingLabel="Saving"
                      onClick={() => {
                        void onLink(account);
                      }}
                    >
                      Save mapping
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
