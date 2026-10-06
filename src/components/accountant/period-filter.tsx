// src/components/accountant/period-filter.tsx
// The period the books are read over. Accountants work in months, quarters
// and years, so the three common choices are one click away and any other
// period can be typed.

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

export interface PeriodFilterProps {
  /** Path the filter writes its query onto. */
  basePath: string;
  /** First day of the period currently shown. */
  periodStart: string;
  /** Last day of the period currently shown. */
  periodEnd: string;
}

interface QuickRange {
  key: string;
  label: string;
  from: string;
  to: string;
}

/**
 * Formats a date as an ISO day.
 *
 * @param value Date to format.
 * @returns The date as YYYY-MM-DD.
 */
function toIsoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Builds the three ranges an accountant asks for most.
 *
 * @returns The quick ranges.
 */
function buildQuickRanges(): QuickRange[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;

  return [
    {
      key: 'month',
      label: 'This month',
      from: toIsoDay(new Date(Date.UTC(year, month, 1))),
      to: toIsoDay(new Date(Date.UTC(year, month + 1, 0))),
    },
    {
      key: 'quarter',
      label: 'This quarter',
      from: toIsoDay(new Date(Date.UTC(year, quarterStartMonth, 1))),
      to: toIsoDay(new Date(Date.UTC(year, quarterStartMonth + 3, 0))),
    },
    {
      key: 'year',
      label: 'This year',
      from: toIsoDay(new Date(Date.UTC(year, 0, 1))),
      to: toIsoDay(new Date(Date.UTC(year, 11, 31))),
    },
  ];
}

/**
 * Renders the period chooser.
 *
 * @param props The path to write to and the period being shown.
 * @returns The rendered form.
 */
export function PeriodFilter({ basePath, periodStart, periodEnd }: PeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(periodStart);
  const [to, setTo] = useState(periodEnd);
  const [isPending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);

  const tab = searchParams.get('tab');
  const ranges = buildQuickRanges();

  /**
   * Sends the browser to the chosen period.
   *
   * @param nextFrom First day of the period.
   * @param nextTo Last day of the period.
   * @returns Nothing.
   */
  function apply(nextFrom: string, nextTo: string): void {
    if (nextFrom > nextTo) {
      setFailure('The period has to end on or after it starts.');

      return;
    }

    setFailure(null);
    setFrom(nextFrom);
    setTo(nextTo);

    const query = new URLSearchParams({ from: nextFrom, to: nextTo });

    if (tab !== null && tab.length > 0) {
      query.set('tab', tab);
    }

    startTransition(() => {
      router.push(`${basePath}?${query.toString()}`);
    });
  }

  /**
   * Applies the typed period.
   *
   * @param event Submit event of the form.
   * @returns Nothing.
   */
  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    apply(from, to);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs sm:flex-row sm:items-end sm:gap-4"
    >
      <FormField
        id="period-from"
        label="From"
        errors={failure === null ? undefined : [failure]}
        isRequired
      >
        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          {...fieldAccessibilityProps('period-from', false, failure !== null)}
        />
      </FormField>

      <FormField id="period-to" label="To" isRequired>
        <Input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          {...fieldAccessibilityProps('period-to', false, false)}
        />
      </FormField>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" isLoading={isPending} loadingLabel="Applying">
          Apply period
        </Button>

        {ranges.map((range) => (
          <Button
            key={range.key}
            type="button"
            variant="secondary"
            onClick={() => apply(range.from, range.to)}
          >
            {range.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
