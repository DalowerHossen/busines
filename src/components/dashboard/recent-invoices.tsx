// src/components/dashboard/recent-invoices.tsx
// The last few invoices, so the dashboard answers the question most people
// open it with: what did I send and has it been paid.

import { FileText } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { DashboardInvoice } from '@/features/dashboard/queries/overview';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface RecentInvoicesProps {
  /** The most recent invoices of the business. */
  invoices: readonly DashboardInvoice[];
}

/**
 * Renders the recent invoice list.
 *
 * @param props Invoices to show.
 * @returns The rendered card.
 */
export function RecentInvoices({ invoices }: RecentInvoicesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent invoices</CardTitle>
        <CardDescription>The last five documents raised for this business.</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {invoices.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={FileText}
            title="No invoices yet"
            description="Your invoices will appear here as soon as the first one is raised, with its status and what is still owed."
          />
        ) : (
          <Table caption="Recent invoices">
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead isNumeric>Total</TableHead>
                <TableHead isNumeric>Outstanding</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.number}</TableCell>
                  <TableCell>{invoice.clientName}</TableCell>
                  <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                  <TableCell>
                    <StatusBadge kind="invoice" status={invoice.status} />
                  </TableCell>
                  <TableCell isNumeric>{formatMoney(invoice.total, invoice.currency)}</TableCell>
                  <TableCell isNumeric>
                    {formatMoney(invoice.balanceDue, invoice.currency)}
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
