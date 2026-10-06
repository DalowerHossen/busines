// src/features/billing/queries/get-billing-overview.ts
// Reading everything the billing page shows: the plan a business is on, the
// plans it could move to, how much of each allowance is gone, and what the
// platform has invoiced.

import type {
  BillingOverview,
  CurrentPlan,
  PlanOption,
  PlanPrice,
  PlatformInvoice,
  UsageMeter,
} from '@/features/billing/types';
import { logger } from '@/lib/logger';
import {
  asRow,
  asRows,
  readAmount,
  readBoolean,
  readEnum,
  readJson,
  readNumber,
  readString,
} from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import type { JsonObject } from '@/types/json';
import { BILLING_INTERVALS, INVOICE_STATUSES, SUBSCRIPTION_STATUSES } from '@/types/enums';

/** How many platform invoices the page lists. */
const INVOICE_LIMIT = 24;

/**
 * Reads a limits document into numbers, keeping unlimited as null.
 *
 * @param document Raw limits or features document.
 * @returns The limits with values the page can render.
 */
function toLimits(document: JsonObject): Record<string, number | null> {
  const limits: Record<string, number | null> = {};

  for (const [key, value] of Object.entries(document)) {
    if (typeof value === 'number') {
      limits[key] = value;
      continue;
    }

    limits[key] = null;
  }

  return limits;
}

/**
 * Reads a features document into switches.
 *
 * @param document Raw features document.
 * @returns The modules the plan unlocks.
 */
function toFeatures(document: JsonObject): Record<string, boolean> {
  const features: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(document)) {
    features[key] = value === true;
  }

  return features;
}

/**
 * Maps one price row.
 *
 * @param row Row read from public.plan_prices.
 * @returns The price the plan card renders.
 */
function toPrice(row: DatabaseRow): PlanPrice {
  return {
    id: readString(row, 'id') ?? '',
    interval: readEnum(row, 'billing_interval', BILLING_INTERVALS, 'monthly'),
    currency: readString(row, 'currency') ?? 'USD',
    amount: readAmount(row, 'amount'),
    compareAtAmount:
      row['compare_at_amount'] === null ? null : readAmount(row, 'compare_at_amount'),
  };
}

/**
 * Maps one plan row together with its prices.
 *
 * @param row Row read from public.subscription_plans.
 * @param prices Price rows belonging to that plan.
 * @returns The plan the picker renders.
 */
function toPlan(row: DatabaseRow, prices: readonly DatabaseRow[]): PlanOption {
  const id = readString(row, 'id') ?? '';

  return {
    id,
    planKey: readString(row, 'plan_key') ?? '',
    name: readString(row, 'name') ?? '',
    tagline: readString(row, 'tagline'),
    description: readString(row, 'description'),
    isFree: readBoolean(row, 'is_free'),
    trialDays: readNumber(row, 'trial_days') ?? 0,
    badgeLabel: readString(row, 'badge_label'),
    displayOrder: readNumber(row, 'display_order') ?? 0,
    limits: toLimits(readJson(row, 'limits')),
    features: toFeatures(readJson(row, 'features')),
    merchantFeePercentage: readAmount(row, 'merchant_of_record_fee_percentage'),
    merchantFeeFixed: readAmount(row, 'merchant_of_record_fee_fixed'),
    prices: prices.filter((price) => readString(price, 'plan_id') === id).map(toPrice),
  };
}

/**
 * Maps the live subscription.
 *
 * @param row Row read from public.subscriptions.
 * @param planName Name of the plan it points at.
 * @param planKey Key of the plan it points at.
 * @returns The plan summary the page renders.
 */
function toCurrentPlan(row: DatabaseRow, planName: string, planKey: string): CurrentPlan {
  return {
    subscriptionId: readString(row, 'id') ?? '',
    planId: readString(row, 'plan_id') ?? '',
    planKey,
    planName,
    status: readEnum(row, 'status', SUBSCRIPTION_STATUSES, 'active'),
    interval: readEnum(row, 'billing_interval', BILLING_INTERVALS, 'monthly'),
    currency: readString(row, 'currency') ?? 'USD',
    amount: readAmount(row, 'amount'),
    discountAmount: readAmount(row, 'discount_amount'),
    currentPeriodStart: readString(row, 'current_period_start') ?? '',
    currentPeriodEnd: readString(row, 'current_period_end') ?? '',
    nextBillingDate: readString(row, 'next_billing_date'),
    trialEndDate: readString(row, 'trial_end_date'),
    cancelAtPeriodEnd: readBoolean(row, 'cancel_at_period_end'),
    cancellationReason: readString(row, 'cancellation_reason'),
    pastDueSince: readString(row, 'past_due_since'),
    gracePeriodEndsOn: readString(row, 'grace_period_ends_on'),
  };
}

/**
 * Maps one platform invoice.
 *
 * @param row Row read from public.subscription_invoices.
 * @returns The invoice the table renders.
 */
function toInvoice(row: DatabaseRow): PlatformInvoice {
  return {
    id: readString(row, 'id') ?? '',
    invoiceNumber: readString(row, 'invoice_number') ?? '',
    status: readEnum(row, 'status', INVOICE_STATUSES, 'sent'),
    description: readString(row, 'description'),
    periodStart: readString(row, 'period_start'),
    periodEnd: readString(row, 'period_end'),
    issueDate: readString(row, 'issue_date') ?? '',
    dueDate: readString(row, 'due_date') ?? '',
    currency: readString(row, 'currency') ?? 'USD',
    subtotalAmount: readAmount(row, 'subtotal_amount'),
    discountAmount: readAmount(row, 'discount_amount'),
    taxAmount: readAmount(row, 'tax_amount'),
    totalAmount: readAmount(row, 'total_amount'),
    paidAmount: readAmount(row, 'paid_amount'),
    balanceDue: readAmount(row, 'balance_due'),
    merchantFeeAmount: readAmount(row, 'merchant_fee_amount'),
    paidAt: readString(row, 'paid_at'),
  };
}

/**
 * Maps one meter returned by the usage snapshot.
 *
 * @param row Row returned by public.company_usage_snapshot.
 * @returns The meter the page renders.
 */
function toMeter(row: DatabaseRow): UsageMeter {
  return {
    metricKey: readString(row, 'metric_key') ?? '',
    periodKey: readString(row, 'period_key') ?? 'all',
    used: readNumber(row, 'used') ?? 0,
    allowance: row['allowance'] === null ? null : (readNumber(row, 'allowance') ?? null),
    remaining: row['remaining'] === null ? null : (readNumber(row, 'remaining') ?? null),
  };
}

/**
 * Reads the billing picture of one business.
 *
 * @param companyId Company whose plan is read.
 * @returns The plan, the catalogue, the meters and the platform invoices.
 */
export async function loadBillingOverview(companyId: string): Promise<BillingOverview> {
  const supabase = createServerSupabaseClient();

  const [subscriptionResult, planResult, priceResult, meterResult, invoiceResult] =
    await Promise.all([
      supabase
        .from('subscriptions')
        .select(
          'id, plan_id, status, billing_interval, currency, amount, discount_amount, current_period_start, current_period_end, next_billing_date, trial_end_date, cancel_at_period_end, cancellation_reason, past_due_since, grace_period_ends_on, subscription_plans(name, plan_key)'
        )
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .not('status', 'in', '(cancelled,expired)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('subscription_plans')
        .select(
          'id, plan_key, name, tagline, description, is_free, trial_days, badge_label, display_order, limits, features, merchant_of_record_fee_percentage, merchant_of_record_fee_fixed'
        )
        .eq('is_public', true)
        .eq('is_archived', false)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      supabase
        .from('plan_prices')
        .select('id, plan_id, billing_interval, currency, amount, compare_at_amount')
        .eq('is_active', true)
        .is('deleted_at', null),
      supabase.rpc('company_usage_snapshot', { p_company_id: companyId }),
      supabase
        .from('subscription_invoices')
        .select(
          'id, invoice_number, status, description, period_start, period_end, issue_date, due_date, currency, subtotal_amount, discount_amount, tax_amount, total_amount, paid_amount, balance_due, merchant_fee_amount, paid_at'
        )
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('issue_date', { ascending: false })
        .limit(INVOICE_LIMIT),
    ]);

  const isDegraded =
    Boolean(subscriptionResult.error) || Boolean(planResult.error) || Boolean(invoiceResult.error);

  if (isDegraded) {
    logger.error(
      'The billing picture could not be read in full',
      subscriptionResult.error ?? planResult.error ?? invoiceResult.error,
      { companyId }
    );
  }

  const priceRows = asRows(priceResult.data);
  const plans = asRows(planResult.data).map((row) => toPlan(row, priceRows));

  const subscriptionRow = asRow(subscriptionResult.data);
  let current: CurrentPlan | null = null;

  if (subscriptionRow !== null) {
    const planId = readString(subscriptionRow, 'plan_id') ?? '';
    const joined = asRow(subscriptionRow['subscription_plans']);
    const matched = plans.find((plan) => plan.id === planId);

    current = toCurrentPlan(
      subscriptionRow,
      readString(joined ?? {}, 'name') ?? matched?.name ?? 'Current plan',
      readString(joined ?? {}, 'plan_key') ?? matched?.planKey ?? 'free'
    );
  }

  return {
    current,
    plans,
    meters: asRows(meterResult.data).map(toMeter),
    invoices: asRows(invoiceResult.data).map(toInvoice),
    isDegraded,
  };
}
