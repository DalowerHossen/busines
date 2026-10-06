// src/components/accountant/ledger-report-table.tsx
// One ledger report rendered by section, used for both the profit and loss
// and the balance sheet. Each section carries its own subtotal and the
// report carries a total, because an accountant reads subtotals first.

import { Fragment } from 'react';

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
import type { LedgerReportLine } from '@/features/accountants/types';
import { formatMoney } from '@/lib/format';
import { addMoney } from '@/lib/money';

export interface LedgerReportTableProps {
  /** Lines of the report. */
  lines: readonly LedgerReportLine[];
  /** Currency the books are kept in. */
  currency: string;
  /** Description announced to a screen reader. */
  caption: string;
  /** Label of the final row. */
  totalLabel: string;
  /** Shown when the report has no lines. */
  emptyTitle: string;
  /** Explains what to do when the report has no lines. */
  emptyDescription: string;
}

/**
 * Renders one ledger report grouped by section.
 *
 * @param props The lines, the currency and the wording around them.
 * @returns The rendered table.
 */
export function LedgerReportTable({
  lines,
  currency,
  caption,
  totalLabel,
  emptyTitle,
  emptyDescription,
}: LedgerReportTableProps) {
  if (lines.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const sections: string[] = [];

  for (const line of lines) {
    if (!sections.includes(line.section)) {
      sections.push(line.section);
    }
  }

  const reportTotal = lines.reduce((total, line) => addMoney(total, line.amount).toString(), '0');

  return (
    <Table caption={caption}>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Account</TableHead>
          <TableHead isNumeric>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sections.map((section) => {
          const sectionLines = lines.filter((line) => line.section === section);
          const sectionSum = sectionLines.reduce(
            (total, line) => addMoney(total, line.amount).toString(),
            '0'
          );

          return (
            <Fragment key={section}>
              <TableRow className="bg-surface-muted">
                <TableCell colSpan={3} className="font-semibold text-foreground">
                  {section}
                </TableCell>
              </TableRow>

              {sectionLines.map((line) => (
                <TableRow key={`${section}-${line.accountCode}`}>
                  <TableCell className="tabular">{line.accountCode}</TableCell>
                  <TableCell>{line.accountName}</TableCell>
                  <TableCell isNumeric>{formatMoney(line.amount, currency)}</TableCell>
                </TableRow>
              ))}

              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  {section} subtotal
                </TableCell>
                <TableCell isNumeric className="font-medium">
                  {formatMoney(sectionSum, currency)}
                </TableCell>
              </TableRow>
            </Fragment>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>{totalLabel}</TableCell>
          <TableCell isNumeric>{formatMoney(reportTotal, currency)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
