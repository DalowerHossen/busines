// src/features/recurring/queries/get-schedule.ts
// Reading one recurring schedule with the template it copies.

import { toScheduleDetail } from '@/features/recurring/mappers';
import type { ScheduleDetail } from '@/features/recurring/types';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DETAIL_COLUMNS =
  'id, name, status, client_id, template_invoice_id, last_generated_invoice_id, frequency, interval_count, custom_interval_days, start_date, end_date, next_run_date, last_run_date, occurrences_generated, max_occurrences, payment_terms_days, days_before_to_create, auto_issue, auto_send, auto_charge, time_zone, notes, paused_at, completed_at, cancelled_at, created_at, deleted_at, clients(display_name), invoices!recurring_schedules_template_fkey(invoice_number, currency, total_amount)';

/**
 * Reads one recurring schedule of a company.
 *
 * @param companyId Company the schedule must belong to.
 * @param scheduleId Schedule being opened.
 * @returns The schedule, or null when it does not exist.
 */
export async function getSchedule(
  companyId: string,
  scheduleId: string
): Promise<ScheduleDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('recurring_invoice_schedules')
    .select(DETAIL_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', scheduleId)
    .maybeSingle();

  if (error) {
    logger.error('Could not read a recurring schedule', error, { companyId, scheduleId });
    return null;
  }

  const row = asRow(data);

  return row === null ? null : toScheduleDetail(row);
}
