// src/components/products/product-filters.tsx
// Search, type, status and category filters above the catalogue. Every choice
// is written into the address bar so the view can be shared and reloaded.

'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { CatalogueReference } from '@/features/products/types';
import { PRODUCT_TYPES } from '@/types/enums';

export interface ProductFiltersProps {
  /** Search text currently applied. */
  search: string | null;
  /** Status currently applied, or null for every status. */
  status: string | null;
  /** Kind of item currently applied, or null for every kind. */
  productType: string | null;
  /** Category currently applied, or null for every category. */
  categoryId: string | null;
  /** The categories this company has. */
  categories: readonly CatalogueReference[];
  /** True when the deleted items are being listed. */
  includeDeleted: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_LABELS: Record<string, string> = {
  goods: 'Goods',
  service: 'Service',
  digital: 'Digital download',
  subscription: 'Subscription',
  billable_expense: 'Billable expense',
};

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  ...PRODUCT_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] ?? value })),
];

/**
 * Renders the filter bar above the catalogue.
 *
 * @param props The filters currently applied and the categories to offer.
 * @returns The rendered filter bar.
 */
export function ProductFilters({
  search,
  status,
  productType,
  categoryId,
  categories,
  includeDeleted,
}: ProductFiltersProps) {
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

  const categoryOptions = [
    { value: 'all', label: 'All categories' },
    ...categories.map((entry) => ({ value: entry.id, label: entry.label })),
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2">
        <label className="visually-hidden" htmlFor="product-search">
          Search the catalogue
        </label>
        <div className="relative w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="product-search"
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
        <label className="visually-hidden" htmlFor="product-type-filter">
          Filter by type
        </label>
        <Select
          id="product-type-filter"
          options={TYPE_OPTIONS}
          value={productType ?? 'all'}
          onChange={(event) => {
            apply('type', event.target.value === 'all' ? null : event.target.value);
          }}
        />

        <label className="visually-hidden" htmlFor="product-status-filter">
          Filter by status
        </label>
        <Select
          id="product-status-filter"
          options={STATUS_OPTIONS}
          value={status ?? 'all'}
          onChange={(event) => {
            apply('status', event.target.value === 'all' ? null : event.target.value);
          }}
        />

        <label className="visually-hidden" htmlFor="product-category-filter">
          Filter by category
        </label>
        <Select
          id="product-category-filter"
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
  );
}
