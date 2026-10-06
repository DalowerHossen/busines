// src/components/recurring/schedule-table.tsx
// The recurring billing list. A table on a wide screen and cards on a
// telephone, with the next run date always in plain sight.

'use client';

import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ScheduleRowActions } from '@/components/recurring/schedule-row-actions';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/config/app';
import { SCHEDULE_STATUS_LABELS, describeCadence } from '@/features/recurring/status';
import type { ScheduleSummary } from '@/features/recurring/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { RecurringScheduleStatus } from '@/types/enums';

export interface ScheduleTableProps {
  /** Schedules on the current page. */
  schedules: readonly ScheduleSummary[];
  /** Schedules matching the filter in total. */
  totalCount: number;
  /** Page currently shown. */
  page: number;
  /** Rows shown on one page. */
  pageSize: number;
  /** True when a search or filter is applied. */
  isFiltered: boolean;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
  /** False when the signed in account may not set up recurring billing. */
  canCreate: boolean;
}

const STATUS_TONES: Record<RecurringScheduleStatus, 'success' | 'warning' | 'neutral' | 'brand'> = {
  draft: 'neutral',
  active: 'success',
  paused: 'warning',
  completed: 'brand',
  cancelled: 'neutral',
};

/**
 * Renders the recurring billing list with paging.
 *
 * @param props The page of schedules and what the account may do.
 * @returns The rendered list.
 */
export function ScheduleTable({
  schedules,
  totalCount,
  page,
  pageSize,
  isFiltered,
  canEdit,
  canDelete,
  canCreate,
}: ScheduleTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Moves to another page of the list.
   *
   * @param nextPage Page to open.
   * @returns Nothing.
   */
  function goToPage(nextPage: number): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPage));
    router.push(`${pathname}?${next.toString()}`);
  }

  /**
   * Changes how many rows are shown on one page.
   *
   * @param nextSize Rows to show.
   * @returns Nothing.
   */
  function changePageSize(nextSize: number): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set('pageSize', String(nextSize));
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  }

  if (schedules.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon={CalendarClock}
        title="No schedules match this view"
        description="Try a different search term, or clear the filters to see every arrangement you have set up."
      />
    ) : (
      <EmptyState
        icon={CalendarClock}
        title="Nothing is billed automatically yet"
        description="Set up a retainer or a subscription once, and the invoice is raised on time every period without anybody remembering."
        action={
          canCreate ? (
            <Link
              href={`${ROUTES.subscriptions}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              New schedule
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <Table caption="Recurring billing arrangements">
          <TableHeader>
            <TableRow>
              <TableHead>Schedule</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>How often</TableHead>
              <TableHead>Next invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead isNumeric>Each run</TableHead>
              <TableHead>
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell>
                  <Link
                    href={`${ROUTES.subscriptions}/${schedule.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {schedule.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {schedule.occurrencesGenerated} issued
                    {schedule.maxOccurrences === null ? '' : ` of ${schedule.maxOccurrences}`}
                  </p>
                </TableCell>
                <TableCell>{schedule.clientName}</TableCell>
                <TableCell>
                  {describeCadence(
                    schedule.frequency,
                    schedule.intervalCount,
                    schedule.customIntervalDays
                  )}
                </TableCell>
                <TableCell>
                  {schedule.nextRunDate === null
                    ? 'Not scheduled'
                    : formatDate(schedule.nextRunDate)}
                </TableCell>
                <TableCell>
                  <Badge tone={STATUS_TONES[schedule.status]}>
                    {SCHEDULE_STATUS_LABELS[schedule.status]}
                  </Badge>
                </TableCell>
                <TableCell isNumeric>{formatMoney(schedule.amount, schedule.currency)}</TableCell>
                <TableCell className="text-right">
                  <ScheduleRowActions schedule={schedule} canEdit={canEdit} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {schedules.map((schedule) => (
          <li
            key={schedule.id}
            className="rounded-lg border border-border bg-surface p-4 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`${ROUTES.subscriptions}/${schedule.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {schedule.name}
                </Link>
                <p className="text-sm text-muted-foreground">{schedule.clientName}</p>
              </div>
              <ScheduleRowActions schedule={schedule} canEdit={canEdit} canDelete={canDelete} />
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Each run</dt>
                <dd className="tabular">{formatMoney(schedule.amount, schedule.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">How often</dt>
                <dd>
                  {describeCadence(
                    schedule.frequency,
                    schedule.intervalCount,
                    schedule.customIntervalDays
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Next invoice</dt>
                <dd>
                  {schedule.nextRunDate === null
                    ? 'Not scheduled'
                    : formatDate(schedule.nextRunDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge tone={STATUS_TONES[schedule.status]}>
                    {SCHEDULE_STATUS_LABELS[schedule.status]}
                  </Badge>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
      />
    </div>
  );
}
