// src/components/expenses/expense-table.tsx
// The expense list. A table on a wide screen and cards on a telephone.

'use client';

import { Receipt } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ExpenseRowActions } from '@/components/expenses/expense-row-actions';
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
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_TONES } from '@/features/expenses/status';
import type { ExpenseSummary } from '@/features/expenses/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ExpenseTableProps {
  /** Claims on the current page. */
  expenses: readonly ExpenseSummary[];
  /** Claims matching the filter in total. */
  totalCount: number;
  /** Page currently shown. */
  page: number;
  /** Rows shown on one page. */
  pageSize: number;
  /** True when a search or filter is applied. */
  isFiltered: boolean;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not approve spending. */
  canApprove: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
  /** False when the signed in account may not record spending. */
  canCreate: boolean;
}

/**
 * Renders the expense list with paging.
 *
 * @param props The page of claims and what the account may do.
 * @returns The rendered list.
 */
export function ExpenseTable({
  expenses,
  totalCount,
  page,
  pageSize,
  isFiltered,
  canEdit,
  canApprove,
  canDelete,
  canCreate,
}: ExpenseTableProps) {
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

  if (expenses.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon={Receipt}
        title="No expenses match this view"
        description="Try a different search term, or clear the filters to see everything you have spent."
      />
    ) : (
      <EmptyState
        icon={Receipt}
        title="No spending recorded yet"
        description="Keep every receipt in one place, recharge what belongs to a client, and know exactly what the business spent this month."
        action={
          canCreate ? (
            <Link
              href={`${ROUTES.expenses}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              Record an expense
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <Table caption="Expense claims">
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead isNumeric>Amount</TableHead>
              <TableHead>
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  <Link
                    href={`${ROUTES.expenses}/${expense.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {expense.expenseNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="text-foreground">{expense.description}</span>
                  <p className="text-xs text-muted-foreground">
                    {expense.categoryName ?? 'Not categorised'}
                    {expense.isBillable ? ' · Recharged to a client' : ''}
                    {expense.isReimbursable ? ' · Owed back to a team member' : ''}
                  </p>
                </TableCell>
                <TableCell>{expense.vendorName ?? 'No supplier recorded'}</TableCell>
                <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                <TableCell>
                  <Badge tone={EXPENSE_STATUS_TONES[expense.status]}>
                    {EXPENSE_STATUS_LABELS[expense.status]}
                  </Badge>
                </TableCell>
                <TableCell isNumeric>
                  {formatMoney(expense.totalAmount, expense.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <ExpenseRowActions
                    expense={expense}
                    canEdit={canEdit}
                    canApprove={canApprove}
                    canDelete={canDelete}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {expenses.map((expense) => (
          <li key={expense.id} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`${ROUTES.expenses}/${expense.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {expense.expenseNumber}
                </Link>
                <p className="text-sm text-muted-foreground">{expense.description}</p>
              </div>
              <ExpenseRowActions
                expense={expense}
                canEdit={canEdit}
                canApprove={canApprove}
                canDelete={canDelete}
              />
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="tabular">{formatMoney(expense.totalAmount, expense.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Supplier</dt>
                <dd>{expense.vendorName ?? 'No supplier recorded'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatDate(expense.expenseDate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge tone={EXPENSE_STATUS_TONES[expense.status]}>
                    {EXPENSE_STATUS_LABELS[expense.status]}
                  </Badge>
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
