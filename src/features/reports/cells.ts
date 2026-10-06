// src/features/reports/cells.ts
// Small builders so every report fills its cells the same way.

import type { ReportCell, ReportRow } from '@/features/reports/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

/**
 * Builds a plain text cell.
 *
 * @param value Text to show, or null when there is nothing.
 * @param fallback What to show in place of nothing.
 * @returns The cell.
 */
export function textCell(value: string | null, fallback = '—'): ReportCell {
  const display = value === null || value.length === 0 ? fallback : value;

  return { display, raw: value };
}

/**
 * Builds a money cell.
 *
 * @param amount Amount as stored, with two decimals.
 * @param currency Currency the amount is in.
 * @returns The cell.
 */
export function moneyCell(amount: string, currency: string): ReportCell {
  return { display: formatMoney(amount, currency), raw: Number.parseFloat(amount) };
}

/**
 * Builds a whole number cell.
 *
 * @param value Number to show.
 * @returns The cell.
 */
export function numberCell(value: number): ReportCell {
  return { display: formatNumber(value), raw: value };
}

/**
 * Builds a date cell.
 *
 * @param value Date as stored, or null when there is none.
 * @returns The cell.
 */
export function dateCell(value: string | null): ReportCell {
  return { display: value === null ? '—' : formatDate(value), raw: value };
}

/**
 * Builds one row of a report.
 *
 * @param key Stable key for the row.
 * @param cells Cells of the row.
 * @returns The row.
 */
export function reportRow(key: string, cells: readonly ReportCell[]): ReportRow {
  return { key, cells: [...cells] };
}
