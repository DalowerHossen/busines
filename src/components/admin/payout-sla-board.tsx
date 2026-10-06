// src/components/admin/payout-sla-board.tsx
// The withdrawals the platform still owes, against the clock it set itself.
//
// A seller forgives a fee far more easily than a late payout. This board
// exists so nobody has to remember which request is nearly late: the ones
// running out of time sort to the top and say so in words.

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PayoutSlaRow } from '@/features/settlements/queries/list-policies';
import { formatDateTime } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface PayoutSlaBoardProps {
  /** Withdrawal requests still open. */
  queue: readonly PayoutSlaRow[];
}

/**
 * Describes how much time is left in plain words.
 *
 * @param row One withdrawal request.
 * @returns The sentence to show.
 */
function timeNote(row: PayoutSlaRow): string {
  const hours = Number(row.hoursRemaining);

  if (row.isBreached) {
    return `Late by ${formatNumber(Math.abs(hours), 1)} hours`;
  }

  if (hours < 4) {
    return `Due in ${formatNumber(hours, 1)} hours`;
  }

  return `Due ${formatDateTime(row.dueAt)}`;
}

/**
 * Renders the withdrawal queue.
 *
 * @param props The open requests.
 * @returns The rendered board.
 */
export function PayoutSlaBoard({ queue }: PayoutSlaBoardProps) {
  const late = queue.filter((row) => row.isBreached).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawals owed</CardTitle>
        <CardDescription>
          {late === 0
            ? 'Every open withdrawal is still inside the promise made to the seller.'
            : `${formatNumber(late)} withdrawals are past the promise made to the seller.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <EmptyState
            title="Nothing is waiting to go out"
            description="When a seller asks for their balance, the request appears here with the time left against it."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead isNumeric>Amount</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Time left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((row) => (
                <TableRow key={row.payoutId}>
                  <TableCell>{row.companyName ?? 'Unnamed account'}</TableCell>
                  <TableCell isNumeric>{formatMoney(row.amount, row.currency)}</TableCell>
                  <TableCell>{humanise(row.status)}</TableCell>
                  <TableCell>{formatDateTime(row.requestedAt)}</TableCell>
                  <TableCell>
                    <Badge tone={row.isBreached ? 'danger' : 'success'}>{timeNote(row)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
