// src/components/accountant/trial-balance-table.tsx
// The trial balance, with the two columns that have to agree at the bottom.
// If they do not, nothing above them can be trusted, so the total row is
// never left off.

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TrialBalanceLine } from '@/features/accountants/types';
import { formatMoney, humanise } from '@/lib/format';
import { addMoney } from '@/lib/money';

export interface TrialBalanceTableProps {
  /** Lines of the trial balance. */
  lines: readonly TrialBalanceLine[];
  /** Currency the books are kept in. */
  currency: string;
}

/**
 * Renders the trial balance with its totals.
 *
 * @param props The lines and the currency.
 * @returns The rendered table.
 */
export function TrialBalanceTable({ lines, currency }: TrialBalanceTableProps) {
  if (lines.length === 0) {
    return (
      <EmptyState
        title="Nothing has been posted in this period"
        description="Change the period, or wait until the business issues an invoice or records a payment."
      />
    );
  }

  const debitTotal = lines.reduce(
    (total, line) => addMoney(total, line.debitTotal).toString(),
    '0'
  );
  const creditTotal = lines.reduce(
    (total, line) => addMoney(total, line.creditTotal).toString(),
    '0'
  );

  return (
    <Table caption="Trial balance for the period">
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Type</TableHead>
          <TableHead isNumeric>Debit</TableHead>
          <TableHead isNumeric>Credit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.accountCode}>
            <TableCell className="tabular">{line.accountCode}</TableCell>
            <TableCell>{line.accountName}</TableCell>
            <TableCell>
              <Badge tone="neutral">{humanise(line.accountType)}</Badge>
            </TableCell>
            <TableCell isNumeric>{formatMoney(line.debitTotal, currency)}</TableCell>
            <TableCell isNumeric>{formatMoney(line.creditTotal, currency)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>TOTAL</TableCell>
          <TableCell isNumeric>{formatMoney(debitTotal, currency)}</TableCell>
          <TableCell isNumeric>{formatMoney(creditTotal, currency)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
