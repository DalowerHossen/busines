// src/lib/dates.ts
// Date handling. Dates that belong to a document are plain calendar dates in
// ISO form; anything with a clock time is a timestamp in UTC.

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';

export type IsoDate = string;

/**
 * Parses an ISO date or timestamp.
 *
 * @param value ISO 8601 date or timestamp.
 * @returns The parsed date, or null when the value cannot be read.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/**
 * Formats a date as a calendar date for storage.
 *
 * @param value Date to format.
 * @returns A string such as "2026-01-14".
 */
export function toIsoDate(value: Date): IsoDate {
  return format(value, 'yyyy-MM-dd');
}

/**
 * Returns today as a calendar date.
 *
 * @returns A string such as "2026-01-14".
 */
export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

/**
 * Formats a date the way documents and tables display it.
 *
 * @param value ISO date, timestamp or date object.
 * @param fallback Text shown when the value is missing.
 * @returns A string such as "14 Jan 2026".
 */
export function formatDate(value: string | Date | null | undefined, fallback = '\u2014'): string {
  const parsed = value instanceof Date ? value : parseDate(value);
  return parsed ? format(parsed, 'd MMM yyyy') : fallback;
}

/**
 * Formats a timestamp with the time of day.
 *
 * @param value ISO timestamp or date object.
 * @param fallback Text shown when the value is missing.
 * @returns A string such as "14 Jan 2026, 09:40".
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  fallback = '\u2014'
): string {
  const parsed = value instanceof Date ? value : parseDate(value);
  return parsed ? format(parsed, 'd MMM yyyy, HH:mm') : fallback;
}

/**
 * Describes how long ago something happened, in plain words.
 *
 * @param value ISO timestamp or date object.
 * @returns A phrase such as "3 days ago" or "in 2 days".
 */
export function describeRelative(value: string | Date | null | undefined): string {
  const parsed = value instanceof Date ? value : parseDate(value);

  if (!parsed) {
    return '\u2014';
  }

  const days = differenceInCalendarDays(startOfDay(parsed), startOfDay(new Date()));

  if (days === 0) {
    return 'today';
  }

  if (days === 1) {
    return 'tomorrow';
  }

  if (days === -1) {
    return 'yesterday';
  }

  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/**
 * Adds a number of days to a calendar date.
 *
 * @param value ISO date.
 * @param days Days to add, which may be negative.
 * @returns The resulting ISO date.
 */
export function addDaysIso(value: IsoDate, days: number): IsoDate {
  const parsed = parseDate(value) ?? new Date();
  return toIsoDate(addDays(parsed, days));
}

/**
 * Adds a number of months to a calendar date, staying inside the month.
 *
 * @param value ISO date.
 * @param months Months to add, which may be negative.
 * @returns The resulting ISO date.
 */
export function addMonthsIso(value: IsoDate, months: number): IsoDate {
  const parsed = parseDate(value) ?? new Date();
  return toIsoDate(addMonths(parsed, months));
}

/**
 * Returns the last calendar date of the month a date falls in.
 *
 * @param value ISO date.
 * @returns The resulting ISO date.
 */
export function endOfMonthIso(value: IsoDate): IsoDate {
  const parsed = parseDate(value) ?? new Date();
  return toIsoDate(endOfMonth(parsed));
}

/**
 * Counts whole days between two calendar dates.
 *
 * @param from Earlier ISO date.
 * @param to Later ISO date.
 * @returns The number of days, negative when the order is reversed.
 */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const start = parseDate(from);
  const end = parseDate(to);

  if (!start || !end) {
    return 0;
  }

  return differenceInCalendarDays(end, start);
}

/**
 * Reports whether a due date has passed.
 *
 * @param dueDate ISO date the payment was due.
 * @returns True when the date is before today.
 */
export function isOverdue(dueDate: string | null | undefined): boolean {
  const parsed = parseDate(dueDate);
  return parsed ? isBefore(startOfDay(parsed), startOfDay(new Date())) : false;
}

/**
 * Reports whether a date is in the future.
 *
 * @param value ISO date or timestamp.
 * @returns True when the date is later than now.
 */
export function isFuture(value: string | null | undefined): boolean {
  const parsed = parseDate(value);
  return parsed ? isAfter(parsed, new Date()) : false;
}
