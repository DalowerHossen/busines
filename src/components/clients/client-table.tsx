// src/components/clients/client-table.tsx
// The client list itself. On a wide screen it is a table; below 640 pixels the
// same rows are shown as cards so nothing has to be scrolled sideways.

'use client';

import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ClientRowActions } from '@/components/clients/client-row-actions';
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
import type { ClientSummary } from '@/features/clients/types';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export interface ClientTableProps {
  /** Clients on the current page. */
  clients: readonly ClientSummary[];
  /** Clients matching the filter in total. */
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
}

const STATUS_TONES: Record<string, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  inactive: 'neutral',
  archived: 'warning',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

/**
 * Renders the list of clients with paging.
 *
 * @param props The page of clients and what the account may do.
 * @returns The rendered list.
 */
export function ClientTable({
  clients,
  totalCount,
  page,
  pageSize,
  isFiltered,
  canEdit,
  canDelete,
}: ClientTableProps) {
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

  if (clients.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon={UserPlus}
        title="No clients match this view"
        description="Try a different search term, or clear the status filter to see every client again."
      />
    ) : (
      <EmptyState
        icon={UserPlus}
        title="Add your first client"
        description="A client holds the name, address and billing terms that are filled in for you every time you raise an invoice."
        action={
          <Link
            href={`${ROUTES.clients}/new`}
            className={cn(buttonVariants({ variant: 'primary' }))}
          >
            Add client
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden sm:block">
        <Table caption="Clients of this company">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Client</TableHead>
              <TableHead scope="col">Number</TableHead>
              <TableHead scope="col">Contact</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Last invoiced</TableHead>
              <TableHead scope="col">
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link
                    href={`${ROUTES.clients}/${client.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {client.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {client.clientType === 'business' ? 'Business' : 'Individual'}
                    {client.countryCode === null ? '' : ` · ${client.countryCode}`}
                  </p>
                </TableCell>
                <TableCell className="tabular">{client.clientNumber}</TableCell>
                <TableCell>
                  {client.email === null ? (
                    <span className="text-muted-foreground">No email yet</span>
                  ) : (
                    <a href={`mailto:${client.email}`} className="hover:text-primary">
                      {client.email}
                    </a>
                  )}
                  {client.phone === null ? null : (
                    <p className="text-xs text-muted-foreground">{client.phone}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={client.isArchived ? 'danger' : STATUS_TONES[client.status]}>
                    {client.isArchived ? 'Deleted' : STATUS_LABELS[client.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {client.lastInvoicedAt === null ? (
                    <span className="text-muted-foreground">Not yet invoiced</span>
                  ) : (
                    formatDate(client.lastInvoicedAt)
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ClientRowActions client={client} canEdit={canEdit} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {clients.map((client) => (
          <li key={client.id} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`${ROUTES.clients}/${client.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {client.displayName}
                </Link>
                <p className="text-xs text-muted-foreground">{client.clientNumber}</p>
              </div>
              <ClientRowActions client={client} canEdit={canEdit} canDelete={canDelete} />
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="text-right">{client.email ?? 'No email yet'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge tone={client.isArchived ? 'danger' : STATUS_TONES[client.status]}>
                    {client.isArchived ? 'Deleted' : STATUS_LABELS[client.status]}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last invoiced</dt>
                <dd>
                  {client.lastInvoicedAt === null
                    ? 'Not yet invoiced'
                    : formatDate(client.lastInvoicedAt)}
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
