// src/components/estimates/estimate-filters.tsx
// Search, status, client and date filters above the estimate list.

'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ESTIMATE_STATUS_LABELS } from '@/features/estimates/status';
import type { InvoiceClientOption } from '@/features/invoices/types';
import { ESTIMATE_STATUSES } from '@/types/enums';

export interface EstimateFiltersProps {
  /** Search text currently applied. */
  search: string | null;
  /** Status currently applied, or null for every status. */
  status: string | null;
  /** Client currently applied, or null for every client. */
  clientId: string | null;
  /** Earliest issue date currently applied. */
  fromDate: string | null;
  /** Latest issue date currently applied. */
  toDate: string | null;
  /** The clients that can be filtered on. */
  clients: readonly InvoiceClientOption[];
  /** True when the deleted drafts are being listed. */
  includeDeleted: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...ESTIMATE_STATUSES.map((value) => ({ value, label: ESTIMATE_STATUS_LABELS[value] })),
];

/**
 * Renders the filter bar above the estimate list.
 *
 * @param props The filters currently applied and the clients to offer.
 * @returns The rendered filter bar.
 */
export function EstimateFilters({
  search,
  status,
  clientId,
  fromDate,
  toDate,
  clients,
  includeDeleted,
}: EstimateFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(search ?? '');

  useEffect(() => {
    setTerm(search ?? '');
  }, [search]);

  /**
   * Replaces one search parameter and returns to the first page.
   *
   * @param key Parameter being changed.
   * @param value New value, or null to remove it.
   * @returns Nothing.
   */
  function apply(key: string, value: string | null): void {
    const next = new URLSearchParams(searchParams.toString());

    if (value === null || value.length === 0) {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    next.delete('page');
    const query = next.toString();
    router.push(query.length > 0 ? `${pathname}?${query}` : pathname);
  }

  /**
   * Applies the search text.
   *
   * @param event Submit event from the search form.
   * @returns Nothing.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    apply('search', term.trim());
  }

  const clientOptions = [
    { value: 'all', label: 'All clients' },
    ...clients.map((client) => ({ value: client.id, label: client.name })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2">
          <label className="visually-hidden" htmlFor="estimate-search">
            Search estimates
          </label>
          <div className="relative w-full">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="estimate-search"
              name="search"
              type="search"
              className="pl-9"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
              }}
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <label className="visually-hidden" htmlFor="estimate-status-filter">
            Filter by status
          </label>
          <Select
            id="estimate-status-filter"
            options={STATUS_OPTIONS}
            value={status ?? 'all'}
            onChange={(event) => {
              apply('status', event.target.value === 'all' ? null : event.target.value);
            }}
          />

          <label className="visually-hidden" htmlFor="estimate-client-filter">
            Filter by client
          </label>
          <Select
            id="estimate-client-filter"
            options={clientOptions}
            value={clientId ?? 'all'}
            onChange={(event) => {
              apply('client', event.target.value === 'all' ? null : event.target.value);
            }}
          />

          <Button
            type="button"
            variant={includeDeleted ? 'primary' : 'ghost'}
            onClick={() => {
              apply('deleted', includeDeleted ? null : '1');
            }}
          >
            {includeDeleted ? 'Showing deleted' : 'Show deleted'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="estimate-from-date">
            Issued from
          </label>
          <Input
            id="estimate-from-date"
            type="date"
            value={fromDate ?? ''}
            onChange={(event) => {
              apply('from', event.target.value);
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="estimate-to-date">
            Issued to
          </label>
          <Input
            id="estimate-to-date"
            type="date"
            value={toDate ?? ''}
            onChange={(event) => {
              apply('to', event.target.value);
            }}
          />
        </div>
        {fromDate === null && toDate === null ? null : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              next.delete('from');
              next.delete('to');
              next.delete('page');
              const query = next.toString();
              router.push(query.length > 0 ? `${pathname}?${query}` : pathname);
            }}
          >
            Clear dates
          </Button>
        )}
      </div>
    </div>
  );
}
