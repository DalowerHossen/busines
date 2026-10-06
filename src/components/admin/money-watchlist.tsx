// src/components/admin/money-watchlist.tsx
// What the platform is carrying risk on: refunds a business has asked a
// colleague to approve, and chargebacks still open against a tenant.

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
import type { OpenDispute, PendingRefund } from '@/features/admin/queries/list-money-queue';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface MoneyWatchlistProps {
  /** Refunds waiting for approval inside a tenant. */
  refunds: readonly PendingRefund[];
  /** Chargebacks still open against a tenant. */
  disputes: readonly OpenDispute[];
}

/**
 * Renders the refund and dispute watchlists.
 *
 * @param props The refunds and disputes to show.
 * @returns The rendered lists.
 */
export function MoneyWatchlist({ refunds, disputes }: MoneyWatchlistProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Refunds awaiting approval</h2>

        {refunds.length === 0 ? (
          <EmptyState
            title="No refund is waiting"
            description="Refunds above a tenant own threshold appear here until somebody inside that business approves them."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead isNumeric>Amount</TableHead>
                  <TableHead>Asked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell>{refund.companyName}</TableCell>
                    <TableCell>{refund.reason}</TableCell>
                    <TableCell isNumeric>{formatMoney(refund.amount, refund.currency)}</TableCell>
                    <TableCell>{formatDateTime(refund.requestedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Chargebacks still open</h2>

        {disputes.length === 0 ? (
          <EmptyState
            title="Nothing is being disputed"
            description="A chargeback raised by any card network against any tenant shows up here with its evidence deadline."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead isNumeric>Amount</TableHead>
                  <TableHead>Evidence due</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell>{dispute.companyName}</TableCell>
                    <TableCell>{dispute.caseNumber ?? 'Not numbered yet'}</TableCell>
                    <TableCell isNumeric>
                      {formatMoney(dispute.disputedAmount, dispute.currency)}
                    </TableCell>
                    <TableCell>
                      {dispute.evidenceDueAt
                        ? formatDate(dispute.evidenceDueAt)
                        : 'No deadline set'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="dispute" status={dispute.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
