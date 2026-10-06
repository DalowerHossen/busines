// src/components/marketplace/catalogue-filters.tsx
// Narrowing the shopfront. The filters live in the address bar so a search
// can be shared, bookmarked and reopened.

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ROUTES } from '@/config/app';
import { LISTING_CATEGORIES } from '@/features/marketplace/validation/marketplace';
import { humanise } from '@/lib/format';

export interface CatalogueFiltersProps {
  /** Category currently applied, when there is one. */
  category: string;
  /** Search text currently applied. */
  search: string;
}

/**
 * Renders the shopfront filters.
 *
 * @param props The filters currently applied.
 * @returns The rendered form.
 */
export function CatalogueFilters({ category, search }: CatalogueFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentCategory, setCurrentCategory] = useState(category);
  const [currentSearch, setCurrentSearch] = useState(search);
  const [isPending, startTransition] = useTransition();

  const tab = searchParams.get('tab') ?? '';

  /**
   * Applies the filters.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const query = new URLSearchParams();

    if (currentCategory.length > 0) {
      query.set('category', currentCategory);
    }

    if (currentSearch.trim().length > 0) {
      query.set('q', currentSearch.trim());
    }

    if (tab.length > 0) {
      query.set('tab', tab);
    }

    const suffix = query.toString();

    startTransition(() => {
      router.push(suffix.length > 0 ? `${ROUTES.marketplace}?${suffix}` : ROUTES.marketplace);
    });
  }

  const options = [
    { value: '', label: 'Every kind of template' },
    ...LISTING_CATEGORIES.map((value) => ({ value, label: humanise(value) })),
  ];

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs sm:flex-row sm:items-end sm:gap-4"
    >
      <FormField id="catalogue-search" label="Search" className="sm:flex-1">
        <Input
          type="search"
          value={currentSearch}
          placeholder="Invoice pack, chart of accounts, reminder set"
          onChange={(event) => setCurrentSearch(event.target.value)}
          {...fieldAccessibilityProps('catalogue-search', false, false)}
        />
      </FormField>

      <FormField id="catalogue-category" label="Kind" className="sm:w-64">
        <Select
          value={currentCategory}
          options={options}
          onChange={(event) => setCurrentCategory(event.target.value)}
          {...fieldAccessibilityProps('catalogue-category', false, false)}
        />
      </FormField>

      <Button type="submit" isLoading={isPending} loadingLabel="Searching">
        Search
      </Button>
    </form>
  );
}
