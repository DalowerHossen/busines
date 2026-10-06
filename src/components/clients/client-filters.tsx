// src/components/clients/client-filters.tsx
// The search box and status filter above the client list. Every choice is
// written into the address bar, so a filtered list can be bookmarked, shared
// and reloaded without losing the view.

'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export interface ClientFiltersProps {
  /** Search text currently applied. */
  search: string | null;
  /** Status currently applied, or null for every status. */
  status: string | null;
  /** True when the deleted clients are being listed. */
  includeDeleted: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

/**
 * Renders the filter bar above the client list.
 *
 * @param props The filters currently applied.
 * @returns The rendered filter bar.
 */
export function ClientFilters({ search, status, includeDeleted }: ClientFiltersProps) {
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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2">
        <label className="visually-hidden" htmlFor="client-search">
          Search clients
        </label>
        <div className="relative w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="client-search"
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
        <label className="visually-hidden" htmlFor="client-status-filter">
          Filter by status
        </label>
        <Select
          id="client-status-filter"
          options={STATUS_OPTIONS}
          value={status ?? 'all'}
          onChange={(event) => {
            apply('status', event.target.value === 'all' ? null : event.target.value);
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
