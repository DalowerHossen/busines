// src/components/reports/report-filters.tsx
// Choosing the period a report covers, with the handful of ranges people ask
// for most kept one click away.

'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addDaysIso, addMonthsIso, todayIso } from '@/lib/dates';

export interface ReportFiltersProps {
  /** First day of the period currently shown. */
  fromDate: string;
  /** Last day of the period currently shown. */
  toDate: string;
}

/**
 * Renders the period picker above a report.
 *
 * @param props The period currently shown.
 * @returns The rendered picker.
 */
export function ReportFilters({ fromDate, toDate }: ReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Applies a period to the address bar.
   *
   * @param from First day of the period.
   * @param to Last day of the period.
   * @returns Nothing.
   */
  function apply(from: string, to: string): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set('from', from);
    next.set('to', to);
    router.push(`${pathname}?${next.toString()}`);
  }

  const today = todayIso();

  const presets = [
    { key: 'month', label: 'This month', from: `${today.slice(0, 7)}-01`, to: today },
    { key: '30', label: 'Last 30 days', from: addDaysIso(today, -29), to: today },
    { key: 'quarter', label: 'Last 3 months', from: addMonthsIso(today, -3), to: today },
    { key: 'year', label: 'Last 12 months', from: addMonthsIso(today, -12), to: today },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="report-from">
            From
          </label>
          <Input
            id="report-from"
            type="date"
            value={fromDate}
            onChange={(event) => {
              apply(event.target.value, toDate);
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="report-to">
            To
          </label>
          <Input
            id="report-to"
            type="date"
            value={toDate}
            onChange={(event) => {
              apply(fromDate, event.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.key}
            type="button"
            variant={preset.from === fromDate && preset.to === toDate ? 'primary' : 'ghost'}
            onClick={() => {
              apply(preset.from, preset.to);
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
