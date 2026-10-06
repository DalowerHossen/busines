// src/components/payments/payment-filters.tsx
// Search, client, method and date filters above the payment list, plus the
// two switches for unapplied money and deleted entries.

'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { PAYMENT_METHOD_LABELS } from '@/components/payments/payment-method-label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { PaymentClientOption } from '@/features/payments/types';
import { PAYMENT_METHOD_TYPES } from '@/types/enums';

export interface PaymentFiltersProps {
  /** Search text currently applied. */
  search: string | null;
  /** Client currently applied, or null for every client. */
  clientId: string | null;
  /** Method currently applied, or null for every method. */
  methodType: string | null;
  /** Earliest receipt date currently applied. */
  fromDate: string | null;
  /** Latest receipt date currently applied. */
  toDate: string | null;
  /** True when only payments with money left over are listed. */
  onlyUnallocated: boolean;
  /** True when deleted payments are listed. */
  includeDeleted: boolean;
  /** The clients that can be filtered on. */
  clients: readonly PaymentClientOption[];
}

const METHOD_OPTIONS = [
  { value: 'all', label: 'All methods' },
  ...PAYMENT_METHOD_TYPES.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })),
];

/**
 * Renders the filter bar above the payment list.
 *
 * @param props The filters currently applied and the clients to offer.
 * @returns The rendered filter bar.
 */
export function PaymentFilters({
  search,
  clientId,
  methodType,
  fromDate,
  toDate,
  onlyUnallocated,
  includeDeleted,
  clients,
}: PaymentFiltersProps) {
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
          <label className="visually-hidden" htmlFor="payment-search">
            Search payments
          </label>
          <div className="relative w-full">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="payment-search"
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
          <label className="visually-hidden" htmlFor="payment-client-filter">
            Filter by client
          </label>
          <Select
            id="payment-client-filter"
            options={clientOptions}
            value={clientId ?? 'all'}
            onChange={(event) => {
              apply('clientId', event.target.value === 'all' ? null : event.target.value);
            }}
          />

          <label className="visually-hidden" htmlFor="payment-method-filter">
            Filter by method
          </label>
          <Select
            id="payment-method-filter"
            options={METHOD_OPTIONS}
            value={methodType ?? 'all'}
            onChange={(event) => {
              apply('methodType', event.target.value === 'all' ? null : event.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="payment-from-date">
            Received from
          </label>
          <Input
            id="payment-from-date"
            type="date"
            value={fromDate ?? ''}
            onChange={(event) => {
              apply('fromDate', event.target.value);
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="payment-to-date">
            Received to
          </label>
          <Input
            id="payment-to-date"
            type="date"
            value={toDate ?? ''}
            onChange={(event) => {
              apply('toDate', event.target.value);
            }}
          />
        </div>

        <Button
          type="button"
          variant={onlyUnallocated ? 'primary' : 'ghost'}
          onClick={() => {
            apply('onlyUnallocated', onlyUnallocated ? null : '1');
          }}
        >
          {onlyUnallocated ? 'Showing unapplied only' : 'Unapplied only'}
        </Button>

        <Button
          type="button"
          variant={includeDeleted ? 'primary' : 'ghost'}
          onClick={() => {
            apply('includeDeleted', includeDeleted ? null : '1');
          }}
        >
          {includeDeleted ? 'Showing deleted' : 'Show deleted'}
        </Button>

        {fromDate === null && toDate === null ? null : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              next.delete('fromDate');
              next.delete('toDate');
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
