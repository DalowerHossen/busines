// src/features/recurring/status.ts
// How a recurring schedule is described to a person, how often it runs, and
// what may be done to it in each state.

import type { RecurrenceFrequency, RecurringScheduleStatus } from '@/types/enums';

export const SCHEDULE_STATUS_LABELS: Record<RecurringScheduleStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Finished',
  cancelled: 'Stopped',
};

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  biweekly: 'Every two weeks',
  monthly: 'Every month',
  quarterly: 'Every quarter',
  semiannual: 'Twice a year',
  annual: 'Every year',
  custom: 'A set number of days',
};

/** Roughly how many times a frequency runs in a year, used for the value estimate. */
const RUNS_PER_YEAR: Record<RecurrenceFrequency, number> = {
  daily: 365,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
  custom: 12,
};

/**
 * Describes how often a schedule runs, in plain words.
 *
 * @param frequency How the schedule repeats.
 * @param intervalCount How many of those periods pass between runs.
 * @param customIntervalDays Days between runs when the frequency is custom.
 * @returns A short phrase for the list and the detail page.
 */
export function describeCadence(
  frequency: RecurrenceFrequency,
  intervalCount: number,
  customIntervalDays: number | null
): string {
  if (frequency === 'custom') {
    const days = customIntervalDays ?? 0;
    return days === 1 ? 'Every day' : `Every ${days} days`;
  }

  if (intervalCount <= 1) {
    return FREQUENCY_LABELS[frequency];
  }

  const unit: Record<RecurrenceFrequency, string> = {
    daily: 'days',
    weekly: 'weeks',
    biweekly: 'fortnights',
    monthly: 'months',
    quarterly: 'quarters',
    semiannual: 'half years',
    annual: 'years',
    custom: 'days',
  };

  return `Every ${intervalCount} ${unit[frequency]}`;
}

/**
 * Works out how many runs a schedule has in a year.
 *
 * @param frequency How the schedule repeats.
 * @param intervalCount How many of those periods pass between runs.
 * @param customIntervalDays Days between runs when the frequency is custom.
 * @returns The number of runs expected in twelve months.
 */
export function runsPerYear(
  frequency: RecurrenceFrequency,
  intervalCount: number,
  customIntervalDays: number | null
): number {
  if (frequency === 'custom') {
    const days = customIntervalDays ?? 0;
    return days > 0 ? 365 / days : 0;
  }

  const interval = intervalCount > 0 ? intervalCount : 1;
  return RUNS_PER_YEAR[frequency] / interval;
}

/**
 * Reports whether the rule of a schedule can still be changed.
 *
 * @param status Status the schedule holds.
 * @returns True when editing is allowed.
 */
export function isEditableSchedule(status: RecurringScheduleStatus): boolean {
  return status === 'draft' || status === 'active' || status === 'paused';
}

/**
 * Reports whether a schedule can be started.
 *
 * @param status Status the schedule holds.
 * @returns True when it can be made active.
 */
export function canActivateSchedule(status: RecurringScheduleStatus): boolean {
  return status === 'draft' || status === 'paused';
}

/**
 * Reports whether a schedule can be put on hold.
 *
 * @param status Status the schedule holds.
 * @returns True when pausing is allowed.
 */
export function canPauseSchedule(status: RecurringScheduleStatus): boolean {
  return status === 'active';
}

/**
 * Reports whether a schedule can be stopped for good.
 *
 * @param status Status the schedule holds.
 * @returns True when stopping is allowed.
 */
export function canStopSchedule(status: RecurringScheduleStatus): boolean {
  return status !== 'cancelled' && status !== 'completed';
}

/**
 * Reports whether an invoice can be produced from the schedule right now.
 *
 * @param status Status the schedule holds.
 * @returns True when a run can be forced.
 */
export function canRunScheduleNow(status: RecurringScheduleStatus): boolean {
  return status === 'active';
}

/**
 * Describes what a schedule in this state is doing.
 *
 * @param status Status the schedule holds.
 * @returns One short sentence for the detail page.
 */
export function describeScheduleStatus(status: RecurringScheduleStatus): string {
  switch (status) {
    case 'draft':
      return 'This schedule is not running yet. Start it and the first invoice is produced on the start date.';
    case 'active':
      return 'This schedule is running. Invoices are produced on their own and appear in your invoice book.';
    case 'paused':
      return 'This schedule is on hold. Nothing is produced until you start it again.';
    case 'completed':
      return 'This schedule has finished: it reached its end date or its last occurrence.';
    case 'cancelled':
      return 'This schedule was stopped. It stays on record with everything it produced.';
    default:
      return 'This schedule is on record.';
  }
}
