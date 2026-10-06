// src/features/recurring/queries/list-schedules.ts
// Reading the recurring schedules of one company, and the value they are
// expected to bill in a normal month.

import { toScheduleSummary } from '@/features/recurring/mappers';
import { runsPerYear } from '@/features/recurring/status';
import type {
  ScheduleListFilters,
  ScheduleSummary,
  ScheduleTotals,
} from '@/features/recurring/types';
import { logger } from '@/lib/logger';
import { addMoney, multiplyMoney, toStoredAmount } from '@/lib/money';
import { asRows } from '@/lib/records';
import { escapeSearchTerm } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { toRange } from '@/lib/validation/pagination';
import type { ListQuery, Paginated } from '@/types/common';

const LIST_COLUMNS =
  'id, name, status, client_id, frequency, interval_count, custom_interval_days, start_date, end_date, next_run_date, last_run_date, occurrences_generated, max_occurrences, auto_issue, auto_send, deleted_at, clients(display_name), invoices!recurring_schedules_template_fkey(invoice_number, currency, total_amount)';

/** How far ahead the summary counts a run as imminent. */
const DUE_WINDOW_DAYS = 7;

export interface ScheduleListResult extends Paginated<ScheduleSummary> {
  /** True when the database could not be reached and an empty page is shown. */
  isDegraded: boolean;
}

/**
 * Lists the recurring schedules of one company.
 *
 * @param companyId Company whose schedules are read.
 * @param query Paging arguments.
 * @param filters Search text and the chosen filters.
 * @returns One page of schedules.
 */
export async function listSchedules(
  companyId: string,
  query: ListQuery,
  filters: ScheduleListFilters
): Promise<ScheduleListResult> {
  const supabase = createServerSupabaseClient();
  const range = toRange(query);

  let statement = supabase
    .from('recurring_invoice_schedules')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('company_id', companyId);

  statement = filters.includeDeleted
    ? statement.not('deleted_at', 'is', null)
    : statement.is('deleted_at', null);

  if (filters.status !== null) {
    statement = statement.eq('status', filters.status);
  }

  if (filters.clientId !== null) {
    statement = statement.eq('client_id', filters.clientId);
  }

  if (filters.search !== null) {
    statement = statement.ilike('name', `%${escapeSearchTerm(filters.search)}%`);
  }

  const { data, count, error } = await statement
    .order('next_run_date', { ascending: true, nullsFirst: false })
    .range(range.from, range.to);

  if (error) {
    logger.error('Could not list the recurring schedules', error, { companyId });

    return {
      items: [],
      totalCount: 0,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: false,
      nextCursor: null,
      isDegraded: true,
    };
  }

  const items = asRows(data).map((row) => toScheduleSummary(row));
  const totalCount = count ?? items.length;

  return {
    items,
    totalCount,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < totalCount,
    nextCursor: null,
    isDegraded: false,
  };
}

/**
 * Totals the recurring book for the summary strip above the list.
 *
 * @param companyId Company whose schedules are totalled.
 * @param baseCurrency Currency the totals are shown in.
 * @param today The date the next run window is measured from.
 * @returns The figures shown above the list.
 */
export async function summariseSchedules(
  companyId: string,
  baseCurrency: string,
  today: string
): Promise<ScheduleTotals> {
  const supabase = createServerSupabaseClient();
  const empty: ScheduleTotals = {
    currency: baseCurrency,
    monthlyValue: '0.00',
    activeCount: 0,
    dueThisWeekCount: 0,
    totalCount: 0,
  };

  const { data, error } = await supabase
    .from('recurring_invoice_schedules')
    .select(LIST_COLUMNS)
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Could not summarise the recurring schedules', error, { companyId });
    return empty;
  }

  const rows = asRows(data).map((row) => toScheduleSummary(row));
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + DUE_WINDOW_DAYS);
  const horizonIso = horizon.toISOString().slice(0, 10);

  let monthlyValue = '0';
  let activeCount = 0;
  let dueThisWeekCount = 0;

  for (const schedule of rows) {
    if (schedule.status !== 'active') {
      continue;
    }

    activeCount += 1;

    const perYear = runsPerYear(
      schedule.frequency,
      schedule.intervalCount,
      schedule.customIntervalDays
    );
    const perMonth = perYear / 12;

    monthlyValue = toStoredAmount(
      addMoney(monthlyValue, toStoredAmount(multiplyMoney(schedule.amount, perMonth.toFixed(6))))
    );

    if (schedule.nextRunDate !== null && schedule.nextRunDate <= horizonIso) {
      dueThisWeekCount += 1;
    }
  }

  return {
    currency: baseCurrency,
    monthlyValue,
    activeCount,
    dueThisWeekCount,
    totalCount: rows.length,
  };
}
