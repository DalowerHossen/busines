// src/components/invoices/invoice-table.tsx
// The invoice list. A table on a wide screen and cards on a telephone, with
// the balance always reading in the currency of the document.

'use client';

import { FilePlus2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { InvoiceRowActions } from '@/components/invoices/invoice-row-actions';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
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
import type { InvoiceSummary } from '@/features/invoices/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface InvoiceTableProps {
  /** Invoices on the current page. */
  invoices: readonly InvoiceSummary[];
  /** Invoices matching the filter in total. */
  totalCount: number;
  /** Page currently shown. */
  page: number;
  /** Rows shown on one page. */
  pageSize: number;
  /** True when a search or filter is applied. */
  isFiltered: boolean;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
  /** False when the signed in account may not raise an invoice. */
  canCreate: boolean;
}

/**
 * Renders the invoice list with paging.
 *
 * @param props The page of invoices and what the account may do.
 * @returns The rendered list.
 */
export function InvoiceTable({
  invoices,
  totalCount,
  page,
  pageSize,
  isFiltered,
  canEdit,
  canDelete,
  canCreate,
}: InvoiceTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Moves to another page of the list.
   *
   * @param nextPage Page to open.
   * @returns Nothing.
   */
  function goToPage(nextPage: number): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPage));
    router.push(`${pathname}?${next.toString()}`);
  }

  /**
   * Changes how many rows are shown on one page.
   *
   * @param nextSize Rows to show.
   * @returns Nothing.
   */
  function changePageSize(nextSize: number): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set('pageSize', String(nextSize));
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  }

  if (invoices.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon={FilePlus2}
        title="No invoices match this view"
        description="Try a different search term, or clear the filters to see the whole book again."
      />
    ) : (
      <EmptyState
        icon={FilePlus2}
        title="Raise your first invoice"
        description="Pick a client, add a line from your catalogue and issue it. The number, the address and the tax are filled in for you."
        action={
          canCreate ? (
            <Link
              href={`${ROUTES.invoices}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              New invoice
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <Table caption="Invoices raised by this company">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Number</TableHead>
              <TableHead scope="col">Client</TableHead>
              <TableHead scope="col">Issued</TableHead>
              <TableHead scope="col">Due</TableHead>
              <TableHead scope="col" isNumeric>
                Total
              </TableHead>
              <TableHead scope="col" isNumeric>
                Balance
              </TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  <Link
                    href={`${ROUTES.invoices}/${invoice.id}`}
                    className="tabular font-medium text-foreground hover:text-primary"
                  >
                    {invoice.invoiceNumber ?? 'Draft'}
                  </Link>
                </TableCell>
                <TableCell>{invoice.clientName}</TableCell>
                <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell isNumeric>
                  {formatMoney(invoice.totalAmount, invoice.currency)}
                </TableCell>
                <TableCell isNumeric>{formatMoney(invoice.balanceDue, invoice.currency)}</TableCell>
                <TableCell>
                  <StatusBadge kind="invoice" status={invoice.status} />
                </TableCell>
                <TableCell className="text-right">
                  <InvoiceRowActions invoice={invoice} canEdit={canEdit} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`${ROUTES.invoices}/${invoice.id}`}
                  className="tabular font-medium text-foreground hover:text-primary"
                >
                  {invoice.invoiceNumber ?? 'Draft'}
                </Link>
                <p className="text-sm text-muted-foreground">{invoice.clientName}</p>
              </div>
              <InvoiceRowActions invoice={invoice} canEdit={canEdit} canDelete={canDelete} />
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="tabular">{formatMoney(invoice.totalAmount, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="tabular">{formatMoney(invoice.balanceDue, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Due</dt>
                <dd>{formatDate(invoice.dueDate)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge kind="invoice" status={invoice.status} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
      />
    </div>
  );
}
