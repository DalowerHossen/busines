// src/features/timesheets/queries/get-timesheets.ts
// Reading the weeks of work waiting to be approved, and the retainers
// running against them.

import type { RetainerRow, TimesheetRow } from '@/features/timesheets/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface TimesheetBoard {
  timesheets: readonly TimesheetRow[];
  retainers: readonly RetainerRow[];
  /** True when something could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the timesheets and retainers of one business.
 *
 * @param companyId Business being read.
 * @param userId The person looking, so their own week is marked.
 * @returns The weeks, the retainers and whether a read failed.
 */
export async function loadTimesheetBoard(
  companyId: string,
  userId: string
): Promise<TimesheetBoard> {
  const supabase = createServerSupabaseClient();

  const [timesheets, retainers] = await Promise.all([
    supabase
      .from('timesheets')
      .select(
        'id, user_id, period_start, period_end, status, total_hours, billable_hours, entry_count, submitted_at, approved_at, rejection_reason, users(full_name)'
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('period_start', { ascending: false })
      .limit(40),
    supabase
      .from('retainer_agreements')
      .select(
        'id, name, status, billing_period, currency, amount, included_hours, overage_hourly_rate, next_billing_date, clients(display_name), retainer_periods(id, period_start, period_end, status, used_hours, remaining_hours, overage_hours)'
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ]);

  if (timesheets.error || retainers.error) {
    logger.error('The timesheets could not be read', timesheets.error ?? retainers.error, {
      companyId,
    });

    return { timesheets: [], retainers: [], isDegraded: true };
  }

  return {
    timesheets: asRows(timesheets.data).map((row) => {
      const person = asRow(row['users']);

      return {
        timesheetId: readString(row, 'id') ?? '',
        personName: person === null ? null : readString(person, 'full_name'),
        periodStart: readString(row, 'period_start') ?? '',
        periodEnd: readString(row, 'period_end') ?? '',
        status: readString(row, 'status') ?? 'pending',
        totalHours: readAmount(row, 'total_hours'),
        billableHours: readAmount(row, 'billable_hours'),
        entryCount: readNumber(row, 'entry_count') ?? 0,
        submittedAt: readString(row, 'submitted_at'),
        approvedAt: readString(row, 'approved_at'),
        rejectionReason: readString(row, 'rejection_reason'),
        isMine: readString(row, 'user_id') === userId,
      };
    }),
    retainers: asRows(retainers.data).map((row) => {
      const client = asRow(row['clients']);
      // The open period is the one that matters; the rest are history.
      const periods = asRows(row['retainer_periods']);
      const open = periods.find((period) => readString(period, 'status') === 'open') ?? null;

      return {
        agreementId: readString(row, 'id') ?? '',
        name: readString(row, 'name') ?? '',
        clientName: client === null ? null : readString(client, 'display_name'),
        status: readString(row, 'status') ?? 'active',
        billingPeriod: readString(row, 'billing_period') ?? 'monthly',
        currency: readString(row, 'currency') ?? 'USD',
        amount: readAmount(row, 'amount'),
        includedHours: readAmount(row, 'included_hours'),
        overageHourlyRate:
          row['overage_hourly_rate'] === null ? null : readAmount(row, 'overage_hourly_rate'),
        nextBillingDate: readString(row, 'next_billing_date'),
        currentPeriodId: open === null ? null : readString(open, 'id'),
        usedHours: open === null ? '0' : readAmount(open, 'used_hours'),
        remainingHours: open === null ? '0' : readAmount(open, 'remaining_hours'),
        overageHours: open === null ? '0' : readAmount(open, 'overage_hours'),
        periodStart: open === null ? null : readString(open, 'period_start'),
        periodEnd: open === null ? null : readString(open, 'period_end'),
      };
    }),
    isDegraded: false,
  };
}
