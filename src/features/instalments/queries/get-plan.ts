// src/features/instalments/queries/get-plan.ts
// Reading one instalment plan with every payment in its schedule.

import type { InstalmentPlanDetail, InstalmentScheduleItem } from '@/features/instalments/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type Json, type JsonObject } from '@/types/json';

/**
 * Reads one text value out of the answer.
 *
 * @param source The plan as the database returned it.
 * @param key Field being read.
 * @returns The value, or null.
 */
function text(source: JsonObject, key: string): string | null {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : null;
}

/**
 * Reads a whole number out of the answer.
 *
 * @param source The plan as the database returned it.
 * @param key Field being read.
 * @returns The number, or nothing.
 */
function whole(source: JsonObject, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Maps the schedule of a plan.
 *
 * @param value The schedule as the database returned it.
 * @returns The payments in order.
 */
function toSchedule(value: Json | undefined): readonly InstalmentScheduleItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonObject).map((entry, index) => ({
    scheduleItemId: text(entry, 'schedule_item_id') ?? '',
    instalmentNumber: whole(entry, 'instalment_number') || index + 1,
    dueDate: text(entry, 'due_date') ?? '',
    amount: text(entry, 'amount') ?? '0',
    principalAmount: text(entry, 'principal_amount') ?? '0',
    interestAmount: text(entry, 'interest_amount') ?? '0',
    paidAmount: text(entry, 'paid_amount') ?? '0',
    lateFeeAmount: text(entry, 'late_fee_amount') ?? '0',
    status: text(entry, 'status') ?? 'scheduled',
    paidAt: text(entry, 'paid_at'),
    lastFailureReason: text(entry, 'last_failure_reason'),
  }));
}

/**
 * Reads one instalment plan.
 *
 * @param planId Plan being read.
 * @returns The plan, or null when it is gone or belongs elsewhere.
 */
export async function loadInstalmentPlan(planId: string): Promise<InstalmentPlanDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('instalment_plan_detail', { p_plan_id: planId });

  if (error || !isJsonObject(data)) {
    if (error) {
      logger.error('One instalment plan could not be read', error, { planId });
    }

    return null;
  }

  return {
    planId: text(data, 'plan_id') ?? planId,
    planReference: text(data, 'plan_reference') ?? '',
    status: text(data, 'status') ?? 'pending',
    provider: text(data, 'provider') ?? 'self_financed',
    invoiceId: text(data, 'invoice_id') ?? '',
    invoiceNumber: text(data, 'invoice_number'),
    clientId: text(data, 'client_id'),
    clientName: text(data, 'client_name'),
    currency: text(data, 'currency') ?? 'USD',
    totalAmount: text(data, 'total_amount') ?? '0',
    downPaymentAmount: text(data, 'down_payment_amount') ?? '0',
    financedAmount: text(data, 'financed_amount') ?? '0',
    interestAmount: text(data, 'interest_amount') ?? '0',
    partnerFeeAmount: text(data, 'partner_fee_amount') ?? '0',
    netSettlementAmount: text(data, 'net_settlement_amount'),
    paidAmount: text(data, 'paid_amount') ?? '0',
    outstandingAmount: text(data, 'outstanding_amount') ?? '0',
    instalmentCount: whole(data, 'instalment_count'),
    paidCount: whole(data, 'paid_count'),
    firstDueDate: text(data, 'first_due_date') ?? '',
    finalDueDate: text(data, 'final_due_date') ?? '',
    approvalDecision: text(data, 'approval_decision'),
    declinedReason: text(data, 'declined_reason'),
    cancellationReason: text(data, 'cancellation_reason'),
    defaultedAt: text(data, 'defaulted_at'),
    completedAt: text(data, 'completed_at'),
    schedule: toSchedule(data.schedule),
  };
}
