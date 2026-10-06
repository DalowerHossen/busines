// src/components/billing/platform-invoice-table.tsx
// What the platform has charged this business, including the collection fees
// kept during each period, with a PDF for the accountant.

import { Download } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
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
import type { PlatformInvoice } from '@/features/billing/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface PlatformInvoiceTableProps {
  /** Invoices the platform has issued to this business. */
  invoices: readonly PlatformInvoice[];
}

/**
 * Renders the platform invoice history.
 *
 * @param props The invoices to show.
 * @returns The rendered table.
 */
export function PlatformInvoiceTable({ invoices }: PlatformInvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <EmptyState
        title="We have not charged you anything yet"
        description="Every charge we raise appears here with the fees we kept during that period, and a PDF you can forward to your accountant."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead isNumeric>Collection fees</TableHead>
              <TableHead isNumeric>Total</TableHead>
              <TableHead isNumeric>Outstanding</TableHead>
              <TableHead>State</TableHead>
              <TableHead>
                <span className="visually-hidden">Download</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.invoiceNumber}</TableCell>
                <TableCell>
                  {invoice.periodStart && invoice.periodEnd
                    ? `${formatDate(invoice.periodStart)} to ${formatDate(invoice.periodEnd)}`
                    : (invoice.description ?? 'One off charge')}
                </TableCell>
                <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                <TableCell isNumeric>
                  {formatMoney(invoice.merchantFeeAmount, invoice.currency)}
                </TableCell>
                <TableCell isNumeric>
                  {formatMoney(invoice.totalAmount, invoice.currency)}
                </TableCell>
                <TableCell isNumeric>{formatMoney(invoice.balanceDue, invoice.currency)}</TableCell>
                <TableCell>
                  <StatusBadge kind="invoice" status={invoice.status} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <a
                      href={`/api/billing/invoices/${invoice.id}/pdf`}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                      aria-label={`Download invoice ${invoice.invoiceNumber}`}
                    >
                      <Download className="size-4" aria-hidden="true" />
                    </a>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">{formatDate(invoice.issueDate)}</p>
              </div>
              <StatusBadge kind="invoice" status={invoice.status} />
            </div>

            <p className="tabular mt-2 font-medium text-foreground">
              {formatMoney(invoice.totalAmount, invoice.currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              Collection fees {formatMoney(invoice.merchantFeeAmount, invoice.currency)}
            </p>

            <a
              href={`/api/billing/invoices/${invoice.id}/pdf`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}
            >
              Download PDF
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
