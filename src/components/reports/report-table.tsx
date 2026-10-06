// src/components/reports/report-table.tsx
// Renders any report: a table on a wide screen, stacked cards on a telephone,
// and the total row kept visible in both.

import { BarChart3 } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReportResult } from '@/features/reports/types';

export interface ReportTableProps {
  /** The finished report to render. */
  report: ReportResult;
}

/**
 * Renders one report table.
 *
 * @param props The report to render.
 * @returns The rendered table.
 */
export function ReportTable({ report }: ReportTableProps) {
  const isNumeric = (index: number): boolean => {
    const column = report.columns[index];
    return column !== undefined && (column.kind === 'money' || column.kind === 'number');
  };

  if (report.rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing to report for this period"
        description="There are no figures in the dates you chose. Try a wider period, or come back once the first invoices are out."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <Table caption={report.title}>
          <TableHeader>
            <TableRow>
              {report.columns.map((column, index) => (
                <TableHead key={column.key} isNumeric={isNumeric(index)}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={row.key}>
                {row.cells.map((cell, index) => (
                  <TableCell key={report.columns[index]?.key ?? index} isNumeric={isNumeric(index)}>
                    {cell.display}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-border bg-surface-muted font-semibold">
              {report.totalRow.cells.map((cell, index) => (
                <TableCell
                  key={`total-${report.columns[index]?.key ?? index}`}
                  isNumeric={isNumeric(index)}
                >
                  {cell.display}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {report.rows.map((row) => (
          <li key={row.key} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <dl className="space-y-1 text-sm">
              {row.cells.map((cell, index) => (
                <div
                  key={report.columns[index]?.key ?? index}
                  className="flex justify-between gap-3"
                >
                  <dt className="text-muted-foreground">{report.columns[index]?.label ?? ''}</dt>
                  <dd className={isNumeric(index) ? 'tabular' : ''}>{cell.display}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        <li className="rounded-lg border-2 border-border bg-surface-muted p-4">
          <dl className="space-y-1 text-sm font-semibold">
            {report.totalRow.cells.map((cell, index) => (
              <div
                key={`total-${report.columns[index]?.key ?? index}`}
                className="flex justify-between gap-3"
              >
                <dt>{report.columns[index]?.label ?? ''}</dt>
                <dd className={isNumeric(index) ? 'tabular' : ''}>{cell.display}</dd>
              </div>
            ))}
          </dl>
        </li>
      </ul>
    </div>
  );
}
