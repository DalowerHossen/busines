// src/features/instalments/queries/list-plans.ts
// Reading the instalment plans of one business and what they are worth.

import type { InstalmentOverview, InstalmentPlanSummary } from '@/features/instalments/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface InstalmentPlanListResult {
  plans: readonly InstalmentPlanSummary[];
  overview: InstalmentOverview;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_OVERVIEW: InstalmentOverview = {
  pendingCount: 0,
  activeCount: 0,
  completedCount: 0,
  defaultedCount: 0,
  outstandingAmount: '0',
  collectedAmount: '0',
  overdueInstalments: 0,
};

/**
 * Reads a whole number out of the overview.
 *
 * @param source The overview as the database returned it.
 * @param key Field being read.
 * @returns The number, or nothing.
 */
function count(source: Record<string, unknown>, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Reads an amount out of the overview.
 *
 * @param source The overview as the database returned it.
 * @param key Field being read.
 * @returns The amount as text.
 */
function amount(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : '0';
}

/**
 * Reads the instalment plans of one business.
 *
 * @param companyId Business whose plans are being read.
 * @param status Optional state to narrow the list to.
 * @returns The plans, the counts, and whether the read failed.
 */
export async function loadInstalmentPlans(
  companyId: string,
  status: string | null = null
): Promise<InstalmentPlanListResult> {
  const supabase = createServerSupabaseClient();

  const [list, overview] = await Promise.all([
    supabase.rpc('company_instalment_plans', {
      p_company_id: companyId,
      p_status: status,
      p_limit: 100,
    }),
    supabase.rpc('instalment_overview', { p_company_id: companyId }),
  ]);

  if (list.error || overview.error) {
    logger.error('The instalment plans could not be read', list.error ?? overview.error, {
      companyId,
    });

    return { plans: [], overview: EMPTY_OVERVIEW, isDegraded: true };
  }

  const plans = asRows(list.data).map((row) => ({
    planId: readString(row, 'plan_id') ?? '',
    planReference: readString(row, 'plan_reference') ?? '',
    status: readString(row, 'status') ?? 'pending',
    provider: readString(row, 'provider') ?? 'self_financed',
    invoiceId: readString(row, 'invoice_id') ?? '',
    invoiceNumber: readString(row, 'invoice_number'),
    clientId: readString(row, 'client_id'),
    clientName: readString(row, 'client_name'),
    currency: readString(row, 'currency') ?? 'USD',
    totalAmount: readString(row, 'total_amount') ?? '0',
    paidAmount: readString(row, 'paid_amount') ?? '0',
    outstandingAmount: readString(row, 'outstanding_amount') ?? '0',
    instalmentCount: readNumber(row, 'instalment_count') ?? 0,
    paidCount: readNumber(row, 'paid_count') ?? 0,
    firstDueDate: readString(row, 'first_due_date') ?? '',
    finalDueDate: readString(row, 'final_due_date') ?? '',
    nextDueDate: readString(row, 'next_due_date'),
    overdueCount: readNumber(row, 'overdue_count') ?? 0,
    requiresDecision: readBoolean(row, 'requires_decision'),
  }));

  const source = isJsonObject(overview.data) ? overview.data : {};

  return {
    plans,
    overview: {
      pendingCount: count(source, 'pending_count'),
      activeCount: count(source, 'active_count'),
      completedCount: count(source, 'completed_count'),
      defaultedCount: count(source, 'defaulted_count'),
      outstandingAmount: amount(source, 'outstanding_amount'),
      collectedAmount: amount(source, 'collected_amount'),
      overdueInstalments: count(source, 'overdue_instalments'),
    },
    isDegraded: false,
  };
}
