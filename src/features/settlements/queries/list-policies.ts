// src/features/settlements/queries/list-policies.ts
// What the platform team sees: the terms in force, the withdrawals still
// owed, and what the whole arrangement earns.

import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type JsonObject } from '@/types/json';

export interface SettlementPolicyRow {
  policyId: string;
  companyId: string | null;
  companyName: string | null;
  name: string;
  feePercentage: string;
  minimumFee: string;
  fixedFee: string;
  holdDays: number;
  payoutSlaHours: number;
  payoutThreshold: string;
  settledCount: number;
  feesCollected: string;
}

export interface PayoutSlaRow {
  payoutId: string;
  companyId: string | null;
  companyName: string | null;
  amount: string;
  currency: string;
  status: string;
  requestedAt: string;
  dueAt: string;
  hoursRemaining: string;
  isBreached: boolean;
}

export interface SettlementRevenue {
  settledCount: number;
  collectedVolume: number;
  platformFees: number;
  gatewayFees: number;
  sellerShare: number;
  heldNow: number;
  awaitingWithdrawal: number;
  reversedCount: number;
  averageFee: number;
}

export interface TopAccountRow {
  companyId: string;
  companyName: string | null;
  currency: string;
  settledCount: number;
  collectedVolume: string;
  platformFees: string;
  hasOwnTerms: boolean;
  feePercentage: string;
}

export interface SettlementConsole {
  policies: readonly SettlementPolicyRow[];
  queue: readonly PayoutSlaRow[];
  revenue: SettlementRevenue;
  topAccounts: readonly TopAccountRow[];
  /** True when something could not be read. */
  isDegraded: boolean;
}

const EMPTY_REVENUE: SettlementRevenue = {
  settledCount: 0,
  collectedVolume: 0,
  platformFees: 0,
  gatewayFees: 0,
  sellerShare: 0,
  heldNow: 0,
  awaitingWithdrawal: 0,
  reversedCount: 0,
  averageFee: 0,
};

/**
 * Reads a number out of the revenue document.
 *
 * @param source The document.
 * @param key Field being read.
 * @returns The number, or zero.
 */
function figure(source: JsonObject, key: string): number {
  const value = source[key];

  if (typeof value === 'number') {
    return value;
  }

  return typeof value === 'string' ? Number.parseFloat(value) || 0 : 0;
}

/**
 * Reads everything the settlement console shows.
 *
 * @returns The terms, the queue, the revenue and whether a read failed.
 */
export async function loadSettlementConsole(): Promise<SettlementConsole> {
  const supabase = createServerSupabaseClient();

  const [policies, queue, revenue, accounts] = await Promise.all([
    supabase.rpc('platform_settlement_policies'),
    supabase.rpc('payout_sla_queue', { p_limit: 50 }),
    supabase.rpc('settlement_revenue_report', { p_from: null, p_to: null }),
    supabase.rpc('top_settlement_accounts', { p_limit: 10 }),
  ]);

  const failure = policies.error ?? queue.error ?? revenue.error ?? accounts.error;

  if (failure) {
    logger.error('The settlement console could not be read', failure);

    return {
      policies: [],
      queue: [],
      revenue: EMPTY_REVENUE,
      topAccounts: [],
      isDegraded: true,
    };
  }

  const totals = isJsonObject(revenue.data) ? revenue.data : {};

  return {
    policies: asRows(policies.data).map((row) => ({
      policyId: readString(row, 'policy_id') ?? '',
      companyId: readString(row, 'company_id'),
      companyName: readString(row, 'company_name'),
      name: readString(row, 'name') ?? '',
      feePercentage: readAmount(row, 'fee_percentage'),
      minimumFee: readAmount(row, 'minimum_fee'),
      fixedFee: readAmount(row, 'fixed_fee'),
      holdDays: readNumber(row, 'hold_days') ?? 0,
      payoutSlaHours: readNumber(row, 'payout_sla_hours') ?? 24,
      payoutThreshold: readAmount(row, 'payout_threshold'),
      settledCount: readNumber(row, 'settled_count') ?? 0,
      feesCollected: readAmount(row, 'fees_collected'),
    })),
    queue: asRows(queue.data).map((row) => ({
      payoutId: readString(row, 'payout_id') ?? '',
      companyId: readString(row, 'company_id'),
      companyName: readString(row, 'company_name'),
      amount: readAmount(row, 'amount'),
      currency: readString(row, 'currency') ?? 'USD',
      status: readString(row, 'status') ?? 'requested',
      requestedAt: readString(row, 'requested_at') ?? '',
      dueAt: readString(row, 'due_at') ?? '',
      hoursRemaining: readAmount(row, 'hours_remaining'),
      isBreached: readBoolean(row, 'is_breached'),
    })),
    revenue: {
      settledCount: figure(totals, 'settled_count'),
      collectedVolume: figure(totals, 'collected_volume'),
      platformFees: figure(totals, 'platform_fees'),
      gatewayFees: figure(totals, 'gateway_fees'),
      sellerShare: figure(totals, 'seller_share'),
      heldNow: figure(totals, 'held_now'),
      awaitingWithdrawal: figure(totals, 'awaiting_withdrawal'),
      reversedCount: figure(totals, 'reversed_count'),
      averageFee: figure(totals, 'average_fee'),
    },
    topAccounts: asRows(accounts.data).map((row) => ({
      companyId: readString(row, 'company_id') ?? '',
      companyName: readString(row, 'company_name'),
      currency: readString(row, 'currency') ?? 'USD',
      settledCount: readNumber(row, 'settled_count') ?? 0,
      collectedVolume: readAmount(row, 'collected_volume'),
      platformFees: readAmount(row, 'platform_fees'),
      hasOwnTerms: readBoolean(row, 'has_own_terms'),
      feePercentage: readAmount(row, 'fee_percentage'),
    })),
    isDegraded: false,
  };
}
