// src/components/expenses/expense-filters.tsx
// Search, status, supplier, category and date filters above the expense list.

'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EXPENSE_STATUS_LABELS } from '@/features/expenses/status';
import type { ExpenseCategoryOption, VendorOption } from '@/features/expenses/types';
import { EXPENSE_STATUSES } from '@/types/enums';

export interface ExpenseFiltersProps {
  /** Search text currently applied. */
  search: string | null;
  /** Status currently applied, or null for every status. */
  status: string | null;
  /** Supplier currently applied, or null for every supplier. */
  vendorId: string | null;
  /** Category currently applied, or null for every category. */
  categoryId: string | null;
  /** Earliest date currently applied. */
  fromDate: string | null;
  /** Latest date currently applied. */
  toDate: string | null;
  /** The suppliers that can be filtered on. */
  vendors: readonly VendorOption[];
  /** The categories that can be filtered on. */
  categories: readonly ExpenseCategoryOption[];
  /** True when the deleted claims are being listed. */
  includeDeleted: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...EXPENSE_STATUSES.map((value) => ({ value, label: EXPENSE_STATUS_LABELS[value] })),
];

/**
 * Renders the filter bar above the expense list.
 *
 * @param props The filters currently applied and the lists to offer.
 * @returns The rendered filter bar.
 */
export function ExpenseFilters({
  search,
  status,
  vendorId,
  categoryId,
  fromDate,
  toDate,
  vendors,
  categories,
  includeDeleted,
}: ExpenseFiltersProps) {
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

  const vendorOptions = [
    { value: 'all', label: 'All suppliers' },
    ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
  ];

  const categoryOptions = [
    { value: 'all', label: 'All categories' },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2">
          <label className="visually-hidden" htmlFor="expense-search">
            Search expenses
          </label>
          <div className="relative w-full">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="expense-search"
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
          <label className="visually-hidden" htmlFor="expense-status-filter">
            Filter by status
          </label>
          <Select
            id="expense-status-filter"
            options={STATUS_OPTIONS}
            value={status ?? 'all'}
            onChange={(event) => {
              apply('status', event.target.value === 'all' ? null : event.target.value);
            }}
          />

          <label className="visually-hidden" htmlFor="expense-vendor-filter">
            Filter by supplier
          </label>
          <Select
            id="expense-vendor-filter"
            options={vendorOptions}
            value={vendorId ?? 'all'}
            onChange={(event) => {
              apply('vendor', event.target.value === 'all' ? null : event.target.value);
            }}
          />

          <label className="visually-hidden" htmlFor="expense-category-filter">
            Filter by category
          </label>
          <Select
            id="expense-category-filter"
            options={categoryOptions}
            value={categoryId ?? 'all'}
            onChange={(event) => {
              apply('category', event.target.value === 'all' ? null : event.target.value);
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
          <label className="text-xs font-medium text-muted-foreground" htmlFor="expense-from-date">
            Spent from
          </label>
          <Input
            id="expense-from-date"
            type="date"
            value={fromDate ?? ''}
            onChange={(event) => {
              apply('from', event.target.value);
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="expense-to-date">
            Spent to
          </label>
          <Input
            id="expense-to-date"
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
