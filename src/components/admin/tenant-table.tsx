// src/components/admin/tenant-table.tsx
// Every business on the platform, with the state it is in, the plan it pays
// for and how far its identity checks have got.

'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
import type { TenantSummary } from '@/features/admin/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';

export interface TenantTableProps {
  /** Tenants on the current page. */
  tenants: readonly TenantSummary[];
  /** Tenants matching the filter in total. */
  totalCount: number;
  /** Page currently shown. */
  page: number;
  /** Rows shown on one page. */
  pageSize: number;
}

/**
 * Renders the tenant list.
 *
 * @param props The tenants and the paging state.
 * @returns The rendered table.
 */
export function TenantTable({ tenants, totalCount, page, pageSize }: TenantTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Moves to another page of the list.
   *
   * @param nextPage Page being opened.
   * @returns Nothing.
   */
  function goToPage(nextPage: number): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPage));
    router.push(`${pathname}?${next.toString()}`);
  }

  /**
   * Changes how many rows are shown at once.
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

  if (tenants.length === 0) {
    return (
      <EmptyState
        title="No business matches this view"
        description="Clear the filters, or search for part of the business name instead."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead isNumeric>Pays</TableHead>
              <TableHead>Identity check</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <Link
                    href={`/admin/tenants/${tenant.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {tenant.displayName}
                  </Link>
                  <span className="block text-sm text-muted-foreground">
                    {tenant.countryCode} · {tenant.baseCurrency}
                    {tenant.morEnabled ? ' · we collect for them' : ''}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge kind="company" status={tenant.status} />
                </TableCell>
                <TableCell>{tenant.planName ?? 'No plan'}</TableCell>
                <TableCell isNumeric>
                  {tenant.planAmount === null
                    ? '—'
                    : formatMoney(tenant.planAmount, tenant.baseCurrency)}
                </TableCell>
                <TableCell>
                  <StatusBadge kind="kyc" status={tenant.kycStatus} />
                </TableCell>
                <TableCell>{formatDate(tenant.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {tenants.map((tenant) => (
          <li key={tenant.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/admin/tenants/${tenant.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {tenant.displayName}
              </Link>
              <StatusBadge kind="company" status={tenant.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {tenant.planName ?? 'No plan'} · joined {formatDate(tenant.createdAt)}
            </p>
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
