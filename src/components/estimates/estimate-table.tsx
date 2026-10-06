// src/components/estimates/estimate-table.tsx
// The quotation list. A table on a wide screen and cards on a telephone, with
// the validity date shown so nothing is left to go stale unnoticed.

'use client';

import { FileSignature } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { EstimateRowActions } from '@/components/estimates/estimate-row-actions';
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
import type { EstimateSummary } from '@/features/estimates/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface EstimateTableProps {
  /** Estimates on the current page. */
  estimates: readonly EstimateSummary[];
  /** Estimates matching the filter in total. */
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
  /** False when the signed in account may not write a quotation. */
  canCreate: boolean;
}

/**
 * Renders the estimate list with paging.
 *
 * @param props The page of estimates and what the account may do.
 * @returns The rendered list.
 */
export function EstimateTable({
  estimates,
  totalCount,
  page,
  pageSize,
  isFiltered,
  canEdit,
  canDelete,
  canCreate,
}: EstimateTableProps) {
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

  if (estimates.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon={FileSignature}
        title="No estimates match this view"
        description="Try a different search term, or clear the filters to see every quotation you have written."
      />
    ) : (
      <EmptyState
        icon={FileSignature}
        title="No quotations yet"
        description="Write what the work will cost, send it, and turn it into an invoice the moment the client says yes."
        action={
          canCreate ? (
            <Link
              href={`${ROUTES.estimates}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              New estimate
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <Table caption="Quotations written by this company">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Number</TableHead>
              <TableHead scope="col">Client</TableHead>
              <TableHead scope="col">Issued</TableHead>
              <TableHead scope="col">Valid until</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" isNumeric>
                Total
              </TableHead>
              <TableHead scope="col">
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimates.map((estimate) => (
              <TableRow key={estimate.id}>
                <TableCell>
                  <Link
                    href={`${ROUTES.estimates}/${estimate.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {estimate.estimateNumber ?? 'Draft'}
                  </Link>
                  {estimate.title === null ? null : (
                    <p className="text-xs text-muted-foreground">{estimate.title}</p>
                  )}
                </TableCell>
                <TableCell>{estimate.clientName}</TableCell>
                <TableCell>{formatDate(estimate.issueDate)}</TableCell>
                <TableCell>
                  {estimate.validUntil === null ? 'No end date' : formatDate(estimate.validUntil)}
                </TableCell>
                <TableCell>
                  <StatusBadge kind="estimate" status={estimate.status} />
                </TableCell>
                <TableCell isNumeric>
                  {formatMoney(estimate.totalAmount, estimate.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <EstimateRowActions estimate={estimate} canEdit={canEdit} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {estimates.map((estimate) => (
          <li
            key={estimate.id}
            className="rounded-lg border border-border bg-surface p-4 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`${ROUTES.estimates}/${estimate.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {estimate.estimateNumber ?? 'Draft'}
                </Link>
                <p className="text-sm text-muted-foreground">{estimate.clientName}</p>
              </div>
              <EstimateRowActions estimate={estimate} canEdit={canEdit} canDelete={canDelete} />
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="tabular">{formatMoney(estimate.totalAmount, estimate.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Valid until</dt>
                <dd>
                  {estimate.validUntil === null ? 'No end date' : formatDate(estimate.validUntil)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge kind="estimate" status={estimate.status} />
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
