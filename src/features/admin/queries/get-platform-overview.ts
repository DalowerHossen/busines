// src/features/admin/queries/get-platform-overview.ts
// Reading the shape of the whole platform in one call, so the console opens
// with real figures rather than a dozen separate counts.

import type { PlatformOverview } from '@/features/admin/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type Json, type JsonObject } from '@/types/json';

/** What the page shows when the figures cannot be read. */
const EMPTY: PlatformOverview = {
  tenants: { total: 0, active: 0, trialing: 0, suspended: 0, joinedThisMonth: 0 },
  accounts: { total: 0, awaitingKyc: 0 },
  subscriptions: { paying: 0, pastDue: 0, monthlyRecurringRevenue: '0' },
  money: { collectedThisMonth: '0', platformFeesThisMonth: '0', payoutsAwaitingReview: 0 },
  attention: { openDisputes: 0, refundsAwaitingApproval: 0 },
  isDegraded: true,
};

/**
 * Reads one nested section of the answer.
 *
 * @param document Whole answer returned by the database.
 * @param key Section being read.
 * @returns The section, or an empty object.
 */
function section(document: JsonObject, key: string): JsonObject {
  const value = document[key];
  return isJsonObject(value) ? value : {};
}

/**
 * Reads a whole number out of a section.
 *
 * @param document Section being read.
 * @param key Entry being read.
 * @returns The number, or zero.
 */
function count(document: JsonObject, key: string): number {
  const value: Json | undefined = document[key];

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/**
 * Reads a money amount out of a section, keeping it as text.
 *
 * @param document Section being read.
 * @param key Entry being read.
 * @returns The amount as a string.
 */
function money(document: JsonObject, key: string): string {
  const value: Json | undefined = document[key];

  if (typeof value === 'number') {
    return String(value);
  }

  return typeof value === 'string' && value.length > 0 ? value : '0';
}

/**
 * Reads the platform overview.
 *
 * @returns The figures the console opens with.
 */
export async function loadPlatformOverview(): Promise<PlatformOverview> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('platform_overview');

  if (error || !isJsonObject(data)) {
    logger.error('The platform overview could not be read', error);

    return EMPTY;
  }

  const tenants = section(data, 'tenants');
  const accounts = section(data, 'accounts');
  const subscriptions = section(data, 'subscriptions');
  const amounts = section(data, 'money');
  const attention = section(data, 'attention');

  return {
    tenants: {
      total: count(tenants, 'total'),
      active: count(tenants, 'active'),
      trialing: count(tenants, 'trialing'),
      suspended: count(tenants, 'suspended'),
      joinedThisMonth: count(tenants, 'joined_this_month'),
    },
    accounts: {
      total: count(accounts, 'total'),
      awaitingKyc: count(accounts, 'awaiting_kyc'),
    },
    subscriptions: {
      paying: count(subscriptions, 'paying'),
      pastDue: count(subscriptions, 'past_due'),
      monthlyRecurringRevenue: money(subscriptions, 'monthly_recurring_revenue'),
    },
    money: {
      collectedThisMonth: money(amounts, 'collected_this_month'),
      platformFeesThisMonth: money(amounts, 'platform_fees_this_month'),
      payoutsAwaitingReview: count(amounts, 'payouts_awaiting_review'),
    },
    attention: {
      openDisputes: count(attention, 'open_disputes'),
      refundsAwaitingApproval: count(attention, 'refunds_awaiting_approval'),
    },
    isDegraded: false,
  };
}
