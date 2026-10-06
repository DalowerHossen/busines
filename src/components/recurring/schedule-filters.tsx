// src/components/recurring/schedule-filters.tsx
// Search and filters above the recurring billing list.

'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SCHEDULE_STATUS_LABELS } from '@/features/recurring/status';
import type { InvoiceClientOption } from '@/features/invoices/types';
import { RECURRING_SCHEDULE_STATUSES } from '@/types/enums';

export interface ScheduleFiltersProps {
  /** Search text currently applied. */
  search: string | null;
  /** Status currently applied, or null for every status. */
  status: string | null;
  /** Client currently applied, or null for every client. */
  clientId: string | null;
  /** The clients that can be filtered on. */
  clients: readonly InvoiceClientOption[];
  /** True when the deleted schedules are being listed. */
  includeDeleted: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...RECURRING_SCHEDULE_STATUSES.map((value) => ({
    value,
    label: SCHEDULE_STATUS_LABELS[value],
  })),
];

/**
 * Renders the filter bar above the recurring billing list.
 *
 * @param props The filters currently applied and the clients to offer.
 * @returns The rendered filter bar.
 */
export function ScheduleFilters({
  search,
  status,
  clientId,
  clients,
  includeDeleted,
}: ScheduleFiltersProps) {
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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2">
        <label className="visually-hidden" htmlFor="schedule-search">
          Search schedules
        </label>
        <div className="relative w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="schedule-search"
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
        <label className="visually-hidden" htmlFor="schedule-status-filter">
          Filter by status
        </label>
        <Select
          id="schedule-status-filter"
          options={STATUS_OPTIONS}
          value={status ?? 'all'}
          onChange={(event) => {
            apply('status', event.target.value === 'all' ? null : event.target.value);
          }}
        />

        <label className="visually-hidden" htmlFor="schedule-client-filter">
          Filter by client
        </label>
        <Select
          id="schedule-client-filter"
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
  );
}
