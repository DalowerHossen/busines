// src/components/disputes/dispute-table.tsx
// Chargebacks raised against this business, the most pressing first.

import Link from 'next/link';

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
import { ROUTES } from '@/config/app';
import type { DisputeSummary } from '@/features/disputes/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface DisputeTableProps {
  /** The disputes to show. */
  disputes: readonly DisputeSummary[];
}

/**
 * Describes how long is left to answer a chargeback.
 *
 * @param dueAt When the provider needs the evidence.
 * @returns A sentence about the deadline, or null when there is none.
 */
function deadlineLabel(dueAt: string | null): string | null {
  if (dueAt === null) {
    return null;
  }

  const remaining = Date.parse(dueAt) - Date.now();

  if (Number.isNaN(remaining)) {
    return null;
  }

  if (remaining <= 0) {
    return `The deadline passed on ${formatDate(dueAt)}`;
  }

  const days = Math.ceil(remaining / 86_400_000);

  return days <= 1 ? 'Due within a day' : `Due in ${days} days`;
}

/**
 * Renders the dispute list.
 *
 * @param props The disputes to show.
 * @returns The rendered list.
 */
export function DisputeTable({ disputes }: DisputeTableProps) {
  if (disputes.length === 0) {
    return (
      <EmptyState
        title="No chargebacks have been raised"
        description="If a client ever disputes a card payment, it appears here with its deadline and the evidence gathered to answer it."
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opened</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead isNumeric>Disputed</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {disputes.map((dispute) => (
              <TableRow key={dispute.id}>
                <TableCell>
                  <Link
                    href={`${ROUTES.payments}/disputes/${dispute.id}`}
                    className="font-medium text-brand-700 underline-offset-2 hover:underline"
                  >
                    {formatDateTime(dispute.openedAt)}
                  </Link>
                </TableCell>
                <TableCell>{dispute.clientName}</TableCell>
                <TableCell>{dispute.invoiceNumber ?? 'Not linked'}</TableCell>
                <TableCell isNumeric>
                  {formatMoney(dispute.disputedAmount, dispute.currency)}
                </TableCell>
                <TableCell>{deadlineLabel(dispute.evidenceDueAt) ?? 'No deadline given'}</TableCell>
                <TableCell>
                  <StatusBadge kind="dispute" status={dispute.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {disputes.map((dispute) => (
          <li key={dispute.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`${ROUTES.payments}/disputes/${dispute.id}`}
                  className="font-medium text-brand-700 underline-offset-2 hover:underline"
                >
                  {dispute.clientName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {dispute.invoiceNumber ?? 'Not linked to an invoice'}
                </p>
              </div>
              <StatusBadge kind="dispute" status={dispute.status} />
            </div>

            <p className="tabular mt-2 font-medium text-foreground">
              {formatMoney(dispute.disputedAmount, dispute.currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              {deadlineLabel(dispute.evidenceDueAt) ?? 'No deadline given'}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
