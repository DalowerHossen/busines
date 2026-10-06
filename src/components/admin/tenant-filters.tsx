// src/components/admin/tenant-filters.tsx
// The search box and the two filters above the tenant list. Every choice is
// written into the address bar so a view can be shared with a colleague.

'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { humanise } from '@/lib/format';
import type { SelectOption } from '@/types/common';
import { COMPANY_STATUSES, KYC_STATUSES } from '@/types/enums';

export interface TenantFiltersProps {
  /** Search text currently applied. */
  search: string | null;
  /** Tenant state currently applied, or null for every state. */
  status: string | null;
  /** Identity check state currently applied, or null for every state. */
  kycStatus: string | null;
}

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'Every state' },
  ...COMPANY_STATUSES.map((status) => ({ value: status, label: humanise(status) })),
];

const KYC_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'Every identity check' },
  ...KYC_STATUSES.map((status) => ({ value: status, label: humanise(status) })),
];

/**
 * Renders the filter bar above the tenant list.
 *
 * @param props The filters currently applied.
 * @returns The rendered filter bar.
 */
export function TenantFilters({ search, status, kycStatus }: TenantFiltersProps) {
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

    if (value === null || value.length === 0 || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    next.delete('page');

    const query = next.toString();
    router.push(query.length > 0 ? `${pathname}?${query}` : pathname);
  }

  /**
   * Applies the typed search term.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    apply('search', term.trim());
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <form onSubmit={onSubmit} className="flex flex-1 gap-2" role="search">
        <Input
          id="tenant-search"
          value={term}
          placeholder="Search by business name or address"
          aria-label="Search tenants"
          onChange={(event) => {
            setTerm(event.target.value);
          }}
        />
        <Button type="submit" variant="secondary" leadingIcon={<Search className="size-4" />}>
          Search
        </Button>
      </form>

      <Select
        id="tenant-status"
        aria-label="Filter by state"
        options={STATUS_OPTIONS}
        value={status ?? 'all'}
        onChange={(event) => {
          apply('status', event.target.value);
        }}
      />

      <Select
        id="tenant-kyc"
        aria-label="Filter by identity check"
        options={KYC_OPTIONS}
        value={kycStatus ?? 'all'}
        onChange={(event) => {
          apply('kyc', event.target.value);
        }}
      />
    </div>
  );
}
