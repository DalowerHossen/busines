// src/features/recurring/mappers.ts
// Turning recurring schedule rows into the shapes the interface renders.

import type { ScheduleDetail, ScheduleSummary } from '@/features/recurring/types';
import { readAmount, readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import { RECURRENCE_FREQUENCIES, RECURRING_SCHEDULE_STATUSES } from '@/types/enums';

/**
 * Reads a field from a joined object such as the client or the template.
 *
 * @param row Row returned by the database.
 * @param column Column holding the joined object.
 * @param field Field of that object to read.
 * @returns The value as text, or null when the join found nothing.
 */
function readJoined(row: DatabaseRow, column: string, field: string): string | null {
  const value = row[column];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const inner = (value as Record<string, unknown>)[field];

  if (typeof inner === 'string' && inner.length > 0) {
    return inner;
  }

  return typeof inner === 'number' ? String(inner) : null;
}

/**
 * Maps one row of the schedule list.
 *
 * @param row Row read from public.recurring_invoice_schedules.
 * @returns The schedule as the list renders it.
 */
export function toScheduleSummary(row: DatabaseRow): ScheduleSummary {
  const templateTotal = readJoined(row, 'invoices', 'total_amount');
  const templateCurrency = readJoined(row, 'invoices', 'currency');

  return {
    id: readString(row, 'id') ?? '',
    name: readString(row, 'name') ?? 'Untitled schedule',
    status: readEnum(row, 'status', RECURRING_SCHEDULE_STATUSES, 'draft'),
    clientId: readString(row, 'client_id') ?? '',
    clientName: readJoined(row, 'clients', 'display_name') ?? 'Client removed',
    currency: templateCurrency ?? 'USD',
    amount: templateTotal ?? '0.00',
    frequency: readEnum(row, 'frequency', RECURRENCE_FREQUENCIES, 'monthly'),
    intervalCount: readNumber(row, 'interval_count') ?? 1,
    customIntervalDays: readNumber(row, 'custom_interval_days'),
    startDate: readString(row, 'start_date') ?? '',
    endDate: readString(row, 'end_date'),
    nextRunDate: readString(row, 'next_run_date'),
    lastRunDate: readString(row, 'last_run_date'),
    occurrencesGenerated: readNumber(row, 'occurrences_generated') ?? 0,
    maxOccurrences: readNumber(row, 'max_occurrences'),
    autoIssue: readBoolean(row, 'auto_issue'),
    autoSend: readBoolean(row, 'auto_send'),
    isDeleted: readString(row, 'deleted_at') !== null,
  };
}

/**
 * Maps the full schedule shown on its own page.
 *
 * @param row Row read from public.recurring_invoice_schedules.
 * @returns The schedule detail record.
 */
export function toScheduleDetail(row: DatabaseRow): ScheduleDetail {
  return {
    ...toScheduleSummary(row),
    templateInvoiceId: readString(row, 'template_invoice_id') ?? '',
    templateInvoiceNumber: readJoined(row, 'invoices', 'invoice_number'),
    lastGeneratedInvoiceId: readString(row, 'last_generated_invoice_id'),
    paymentTermsDays: readNumber(row, 'payment_terms_days') ?? 30,
    daysBeforeToCreate: readNumber(row, 'days_before_to_create') ?? 0,
    autoCharge: readBoolean(row, 'auto_charge'),
    timeZone: readString(row, 'time_zone') ?? 'UTC',
    notes: readString(row, 'notes'),
    pausedAt: readString(row, 'paused_at'),
    completedAt: readString(row, 'completed_at'),
    cancelledAt: readString(row, 'cancelled_at'),
    createdAt: readString(row, 'created_at'),
  };
}

/**
 * Reads the amount of a template invoice, used by the value estimate.
 *
 * @param row Row read from public.invoices.
 * @returns The total of the template.
 */
export function toTemplateAmount(row: DatabaseRow): string {
  return readAmount(row, 'total_amount');
}
