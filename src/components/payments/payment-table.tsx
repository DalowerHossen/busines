// src/components/payments/payment-table.tsx
// The list of money received. A table on a wide screen and cards on a
// telephone, with anything still unallocated clearly marked.

'use client';

import { HandCoins } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { PAYMENT_METHOD_LABELS } from '@/components/payments/payment-method-label';
import { PaymentRowActions } from '@/components/payments/payment-row-actions';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/config/app';
import type { PaymentSummary } from '@/features/payments/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface PaymentTableProps {
  /** Payments on the current page. */
  payments: readonly PaymentSummary[];
  /** Payments matching the filter in total. */
  totalCount: number;
  /** Page currently shown. */
  page: number;
  /** Rows shown on one page. */
  pageSize: number;
  /** True when a search or filter is applied. */
  isFiltered: boolean;
  /** False when the signed in account may not record money. */
  canCreate: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

/**
 * Renders the payment list with paging.
 *
 * @param props The page of payments and what the account may do.
 * @returns The rendered list.
 */
export function PaymentTable({
  payments,
  totalCount,
  page,
  pageSize,
  isFiltered,
  canCreate,
  canDelete,
}: PaymentTableProps) {
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

  if (payments.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon={HandCoins}
        title="No payments match this view"
        description="Try a different search term, or clear the filters to see everything that has come in."
      />
    ) : (
      <EmptyState
        icon={HandCoins}
        title="Nothing has come in yet"
        description="Record a bank transfer, a cash payment or a cheque here and the invoice it belongs to is settled at the same moment."
        action={
          canCreate ? (
            <Link
              href={`${ROUTES.payments}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              Record a payment
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <Table caption="Money received by this company">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Received</TableHead>
              <TableHead scope="col">Client</TableHead>
              <TableHead scope="col">Method</TableHead>
              <TableHead scope="col">Reference</TableHead>
              <TableHead scope="col" isNumeric>
                Amount
              </TableHead>
              <TableHead scope="col" isNumeric>
                Unapplied
              </TableHead>
              <TableHead scope="col">
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>
                  <Link
                    href={`${ROUTES.payments}/${payment.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {formatDate(payment.receivedAt)}
                  </Link>
                  {payment.paymentNumber === null ? null : (
                    <p className="tabular text-xs text-muted-foreground">{payment.paymentNumber}</p>
                  )}
                </TableCell>
                <TableCell>{payment.clientName}</TableCell>
                <TableCell>{PAYMENT_METHOD_LABELS[payment.methodType]}</TableCell>
                <TableCell>{payment.reference ?? '—'}</TableCell>
                <TableCell isNumeric>{formatMoney(payment.amount, payment.currency)}</TableCell>
                <TableCell isNumeric>
                  {Number.parseFloat(payment.unallocatedAmount) > 0 ? (
                    <Badge tone="warning">
                      {formatMoney(payment.unallocatedAmount, payment.currency)}
                    </Badge>
                  ) : (
                    <Badge tone="success">Applied</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <PaymentRowActions payment={payment} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {payments.map((payment) => (
          <li key={payment.id} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`${ROUTES.payments}/${payment.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {formatMoney(payment.amount, payment.currency)}
                </Link>
                <p className="text-sm text-muted-foreground">{payment.clientName}</p>
              </div>
              <PaymentRowActions payment={payment} canDelete={canDelete} />
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Received</dt>
                <dd>{formatDate(payment.receivedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Method</dt>
                <dd>{PAYMENT_METHOD_LABELS[payment.methodType]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Unapplied</dt>
                <dd className="tabular">
                  {formatMoney(payment.unallocatedAmount, payment.currency)}
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
