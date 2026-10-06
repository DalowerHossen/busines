// src/features/collections/queries/get-collections.ts
// Reading what a business is owed, and how it is going about asking.

import type { CollectionsSummary, PromiseRow, ReminderRuleRow } from '@/features/collections/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface CollectionsBoard {
  summary: CollectionsSummary;
  rules: readonly ReminderRuleRow[];
  promises: readonly PromiseRow[];
  /** True when something could not be read. */
  isDegraded: boolean;
}

const EMPTY_SUMMARY: CollectionsSummary = {
  overdueAmount: '0',
  overdueCount: 0,
  dueWithinAWeek: '0',
  scheduledReminders: 0,
  promisedAmount: '0',
  isEnabled: true,
  timeZone: 'UTC',
  quietHoursStart: '20:00',
  quietHoursEnd: '08:00',
  sendingWeekdays: [1, 2, 3, 4, 5],
  sendStatements: false,
  statementDayOfMonth: null,
  hasSettings: false,
};

/**
 * Reads the collections position of one business.
 *
 * @param companyId Business being read.
 * @returns What is owed, the reminders set up, and the promises made.
 */
export async function loadCollectionsBoard(companyId: string): Promise<CollectionsBoard> {
  const supabase = createServerSupabaseClient();

  const [summary, rules, promises] = await Promise.all([
    supabase.rpc('collections_overview', { p_company_id: companyId }),
    supabase.rpc('reminder_rule_list', { p_company_id: companyId }),
    supabase.rpc('open_payment_promises', { p_company_id: companyId }),
  ]);

  if (summary.error || rules.error) {
    logger.error('The collections screen could not be read', summary.error ?? rules.error, {
      companyId,
    });

    return { summary: EMPTY_SUMMARY, rules: [], promises: [], isDegraded: true };
  }

  const totals = isJsonObject(summary.data) ? summary.data : {};

  /**
   * Reads an amount out of the summary as a string.
   *
   * @param key Field being read.
   * @returns The amount.
   */
  function amount(key: string): string {
    const value = totals[key];

    if (typeof value === 'string') {
      return value;
    }

    return typeof value === 'number' ? String(value) : '0';
  }

  const weekdays = Array.isArray(totals['sending_weekdays'])
    ? totals['sending_weekdays'].filter((entry): entry is number => typeof entry === 'number')
    : [1, 2, 3, 4, 5];

  return {
    summary: {
      overdueAmount: amount('overdue_amount'),
      overdueCount: typeof totals['overdue_count'] === 'number' ? totals['overdue_count'] : 0,
      dueWithinAWeek: amount('due_within_a_week'),
      scheduledReminders:
        typeof totals['scheduled_reminders'] === 'number' ? totals['scheduled_reminders'] : 0,
      promisedAmount: amount('promised_amount'),
      isEnabled: totals['is_enabled'] !== false,
      timeZone: typeof totals['time_zone'] === 'string' ? totals['time_zone'] : 'UTC',
      quietHoursStart:
        typeof totals['quiet_hours_start'] === 'string'
          ? totals['quiet_hours_start'].slice(0, 5)
          : '20:00',
      quietHoursEnd:
        typeof totals['quiet_hours_end'] === 'string'
          ? totals['quiet_hours_end'].slice(0, 5)
          : '08:00',
      sendingWeekdays: weekdays,
      sendStatements: totals['send_statements'] === true,
      statementDayOfMonth:
        typeof totals['statement_day_of_month'] === 'number'
          ? totals['statement_day_of_month']
          : null,
      hasSettings: totals['has_settings'] === true,
    },
    rules: asRows(rules.data).map((row) => ({
      ruleId: readString(row, 'rule_id') ?? '',
      name: readString(row, 'name') ?? '',
      offsetDays: readNumber(row, 'offset_days') ?? 0,
      minimumBalance: readAmount(row, 'minimum_balance'),
      maxReminders: readNumber(row, 'max_reminders') ?? 4,
      skipIfPromiseToPay: readBoolean(row, 'skip_if_promise_to_pay'),
      isActive: readBoolean(row, 'is_active'),
      scheduledCount: readNumber(row, 'scheduled_count') ?? 0,
      sentCount: readNumber(row, 'sent_count') ?? 0,
    })),
    promises: asRows(promises.data).map((row) => ({
      promiseId: readString(row, 'promise_id') ?? '',
      invoiceId: readString(row, 'invoice_id') ?? '',
      invoiceNumber: readString(row, 'invoice_number'),
      clientName: readString(row, 'client_name'),
      promisedDate: readString(row, 'promised_date') ?? '',
      promisedAmount: row['promised_amount'] === null ? null : readAmount(row, 'promised_amount'),
      balanceDue: readAmount(row, 'balance_due'),
      note: readString(row, 'note'),
      isLate: readBoolean(row, 'is_late'),
    })),
    isDegraded: false,
  };
}
