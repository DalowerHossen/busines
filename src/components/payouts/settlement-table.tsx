// src/components/payouts/settlement-table.tsx
// Every payment collected for this business, and what became of it.
//
// One row per payment, with the three deductions side by side so the figures
// can be checked against the invoice without a calculator.

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SettlementRecord } from '@/features/settlements/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface SettlementTableProps {
  /** The settlements to show, newest first. */
  settlements: readonly SettlementRecord[];
}

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  available: 'success',
  held: 'warning',
  paid_out: 'neutral',
  reversed: 'danger',
};

/**
 * Describes what one state means in a few words.
 *
 * @param settlement The settlement.
 * @returns The sentence to show under the state.
 */
function stateNote(settlement: SettlementRecord): string {
  if (settlement.status === 'held') {
    return `Yours on ${formatDate(settlement.holdUntil)}`;
  }

  if (settlement.status === 'paid_out') {
    return settlement.paidOutAt === null
      ? 'Sent to you'
      : `Sent ${formatDate(settlement.paidOutAt)}`;
  }

  if (settlement.status === 'reversed') {
    return 'Taken back after a refund or dispute';
  }

  return 'Ready to withdraw';
}

/**
 * Renders the settlement table.
 *
 * @param props The settlements.
 * @returns The rendered table.
 */
export function SettlementTable({ settlements }: SettlementTableProps) {
  if (settlements.length === 0) {
    return (
      <EmptyState
        title="No money has been collected yet"
        description="As soon as a client pays one of your invoices by card, the payment appears here with the fees and your share spelled out."
      />
    );
  }

  const currency = settlements[0]?.currency ?? 'USD';
  const total = settlements.reduce(
    (running, entry) => running + Number.parseFloat(entry.netAmount),
    0
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Paid</TableHead>
          <TableHead isNumeric>Client paid</TableHead>
          <TableHead isNumeric>Card charges</TableHead>
          <TableHead isNumeric>Our fee</TableHead>
          <TableHead isNumeric>Yours</TableHead>
          <TableHead>State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {settlements.map((settlement) => (
          <TableRow key={settlement.settlementId}>
            <TableCell>{settlement.invoiceNumber ?? 'Direct payment'}</TableCell>
            <TableCell>{settlement.clientName ?? 'Not recorded'}</TableCell>
            <TableCell>{formatDate(settlement.createdAt)}</TableCell>
            <TableCell isNumeric>
              {formatMoney(settlement.grossAmount, settlement.currency)}
            </TableCell>
            <TableCell isNumeric>
              {formatMoney(settlement.gatewayFeeAmount, settlement.currency)}
            </TableCell>
            <TableCell isNumeric>
              {formatMoney(settlement.platformFeeAmount, settlement.currency)}
            </TableCell>
            <TableCell isNumeric>
              {formatMoney(settlement.netAmount, settlement.currency)}
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <Badge tone={STATUS_TONES[settlement.status] ?? 'neutral'}>
                  {humanise(settlement.status)}
                </Badge>
                <p className="text-sm text-muted-foreground">{stateNote(settlement)}</p>
              </div>
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={6}>TOTAL</TableCell>
          <TableCell isNumeric>{formatMoney(total.toFixed(2), currency)}</TableCell>
          <TableCell>Across the payments shown</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
