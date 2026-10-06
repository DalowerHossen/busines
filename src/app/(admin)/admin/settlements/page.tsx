// src/app/(admin)/admin/settlements/page.tsx
// The commercial console: what the platform charges, what it is holding,
// and what it still owes its sellers.

import type { Metadata } from 'next';

import { PayoutSlaBoard } from '@/components/admin/payout-sla-board';
import { SettlementPolicyManager } from '@/components/admin/settlement-policy-manager';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listTenants } from '@/features/admin/queries/list-tenants';
import { loadSettlementConsole } from '@/features/settlements/queries/list-policies';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { formatMoney, formatNumber } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Collection terms',
  description: 'What the platform charges, holds and owes.',
  path: '/admin/settlements',
  noIndex: true,
});

/**
 * Renders the settlement console.
 *
 * @returns The rendered page.
 */
export default async function AdminSettlementsPage() {
  await requireSuperAdmin();

  const [console_, tenants] = await Promise.all([
    loadSettlementConsole(),
    listTenants(
      {
        page: 1,
        pageSize: 100,
        sortBy: 'display_name',
        sortDirection: 'asc',
        search: null,
        cursor: null,
      },
      { search: null, status: null, kycStatus: null }
    ),
  ]);

  const revenue = console_.revenue;
  const tiles = [
    {
      label: 'Collected in the last 30 days',
      value: formatMoney(revenue.collectedVolume.toFixed(2), 'USD'),
      note: `${formatNumber(revenue.settledCount)} payments`,
    },
    {
      label: 'Kept by the platform',
      value: formatMoney(revenue.platformFees.toFixed(2), 'USD'),
      note: `Average ${formatMoney(revenue.averageFee.toFixed(2), 'USD')} per payment`,
    },
    {
      label: 'Held for sellers',
      value: formatMoney(revenue.heldNow.toFixed(2), 'USD'),
      note: 'Inside the hold window',
    },
    {
      label: 'Waiting to be withdrawn',
      value: formatMoney(revenue.awaitingWithdrawal.toFixed(2), 'USD'),
      note: `${formatNumber(revenue.reversedCount)} payments reversed`,
    },
  ];

  const accounts = tenants.items.map((tenant) => ({
    id: tenant.id,
    name: tenant.displayName === '' ? tenant.legalName : tenant.displayName,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collection terms"
        description="Every payment a client makes is split three ways before it reaches a seller. This page sets that split, the hold period and the withdrawal promise, and shows what the arrangement is earning."
      />

      {console_.isDegraded ? (
        <Alert tone="warning" title="Some figures could not be read">
          Nothing has been changed. Reload before editing the terms.
        </Alert>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="space-y-1 pt-6">
              <dt className="text-sm text-muted-foreground">{tile.label}</dt>
              <dd className="tabular text-2xl font-semibold">{tile.value}</dd>
              <p className="text-sm text-muted-foreground">{tile.note}</p>
            </CardContent>
          </Card>
        ))}
      </dl>

      <SettlementPolicyManager policies={console_.policies} accounts={accounts} />

      <PayoutSlaBoard queue={console_.queue} />

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Accounts worth a conversation
          </h2>

          {console_.topAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No money has been collected through the platform yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead isNumeric>Payments</TableHead>
                  <TableHead isNumeric>Volume</TableHead>
                  <TableHead isNumeric>Fees paid</TableHead>
                  <TableHead>Terms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {console_.topAccounts.map((account) => (
                  <TableRow key={account.companyId}>
                    <TableCell>{account.companyName ?? 'Unnamed account'}</TableCell>
                    <TableCell isNumeric>{formatNumber(account.settledCount)}</TableCell>
                    <TableCell isNumeric>
                      {formatMoney(account.collectedVolume, account.currency)}
                    </TableCell>
                    <TableCell isNumeric>
                      {formatMoney(account.platformFees, account.currency)}
                    </TableCell>
                    <TableCell>
                      {account.hasOwnTerms
                        ? `Negotiated at ${formatNumber(Number(account.feePercentage), 2)}%`
                        : 'Standard'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
