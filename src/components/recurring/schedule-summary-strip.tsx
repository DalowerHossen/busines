// src/components/recurring/schedule-summary-strip.tsx
// The figures above the recurring list: what the book is worth in a normal
// month, how much of it is running, and what goes out this week.

import { CalendarClock, Layers, Play, Repeat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ScheduleTotals } from '@/features/recurring/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface ScheduleSummaryStripProps {
  /** Totals read from the database. */
  totals: ScheduleTotals;
}

interface SummaryTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Renders the figures above the recurring billing list.
 *
 * @param props The totals to show.
 * @returns The rendered strip.
 */
export function ScheduleSummaryStrip({ totals }: ScheduleSummaryStripProps) {
  const tiles: SummaryTile[] = [
    {
      key: 'monthly',
      label: 'Billed each month',
      value: formatMoney(totals.monthlyValue, totals.currency),
      hint: 'Every running schedule, averaged over a month',
      icon: Repeat,
    },
    {
      key: 'active',
      label: 'Running',
      value: formatNumber(totals.activeCount),
      hint: 'Schedules producing invoices right now',
      icon: Play,
    },
    {
      key: 'due',
      label: 'Due this week',
      value: formatNumber(totals.dueThisWeekCount),
      hint: 'Invoices going out within seven days',
      icon: CalendarClock,
    },
    {
      key: 'total',
      label: 'All schedules',
      value: formatNumber(totals.totalCount),
      hint: 'Including drafts and ones on hold',
      icon: Layers,
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <tile.icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="tabular text-xl font-semibold text-foreground">{tile.value}</dd>
            <p className="text-xs text-muted-foreground">{tile.hint}</p>
          </div>
        </div>
      ))}
    </dl>
  );
}
