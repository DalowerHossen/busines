// src/features/settlements/queries/list-settlements.ts
// Reading what became of the money collected for one business.

import type { SettlementRecord, SettlementSummary } from '@/features/settlements/types';
import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type JsonObject } from '@/types/json';

export interface EarningsBoard {
  settlements: readonly SettlementRecord[];
  summary: SettlementSummary;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_SUMMARY: SettlementSummary = {
  heldAmount: '0',
  availableAmount: '0',
  paidOutAmount: '0',
  feesPaid: '0',
  nextReleaseDate: null,
  currency: 'USD',
  walletId: null,
  isFrozen: false,
  feePercentage: 0,
  minimumFee: '0',
  holdDays: 0,
  payoutSlaHours: 24,
  payoutThreshold: '0',
};

/**
 * Reads a decimal out of the summary as a string, so no precision is lost.
 *
 * @param source The summary.
 * @param key Field being read.
 * @returns The amount, as a string.
 */
function amount(source: JsonObject, key: string): string {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : '0';
}

/**
 * Reads a whole number out of the summary.
 *
 * @param source The summary.
 * @param key Field being read.
 * @returns The number, or zero.
 */
function whole(source: JsonObject, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Reads the settlements and the totals in one pass.
 *
 * @param companyId Business whose money is being read.
 * @param status Optional state to narrow the list to.
 * @returns The settlements, the totals and whether the read failed.
 */
export async function loadEarningsBoard(
  companyId: string,
  status: string | null = null
): Promise<EarningsBoard> {
  const supabase = createServerSupabaseClient();

  const [settlements, summary] = await Promise.all([
    supabase.rpc('company_settlements', {
      p_company_id: companyId,
      p_status: status,
      p_limit: 50,
    }),
    supabase.rpc('company_settlement_summary', { p_company_id: companyId }),
  ]);

  if (settlements.error || summary.error) {
    logger.error(
      'The earnings of a business could not be read',
      settlements.error ?? summary.error,
      { companyId }
    );

    return { settlements: [], summary: EMPTY_SUMMARY, isDegraded: true };
  }

  const totals = isJsonObject(summary.data) ? summary.data : {};

  return {
    settlements: asRows(settlements.data).map((row) => ({
      settlementId: readString(row, 'settlement_id') ?? '',
      invoiceId: readString(row, 'invoice_id'),
      invoiceNumber: readString(row, 'invoice_number'),
      clientName: readString(row, 'client_name'),
      currency: readString(row, 'currency') ?? 'USD',
      grossAmount: readString(row, 'gross_amount') ?? '0',
      gatewayFeeAmount: readString(row, 'gateway_fee_amount') ?? '0',
      platformFeeAmount: readString(row, 'platform_fee_amount') ?? '0',
      netAmount: readString(row, 'net_amount') ?? '0',
      status: readString(row, 'status') ?? 'held',
      holdUntil: readString(row, 'hold_until') ?? '',
      releasedAt: readString(row, 'released_at'),
      paidOutAt: readString(row, 'paid_out_at'),
      createdAt: readString(row, 'created_at') ?? '',
    })),
    summary: {
      heldAmount: amount(totals, 'held_amount'),
      availableAmount: amount(totals, 'available_amount'),
      paidOutAmount: amount(totals, 'paid_out_amount'),
      feesPaid: amount(totals, 'fees_paid'),
      nextReleaseDate:
        typeof totals['next_release_date'] === 'string' ? totals['next_release_date'] : null,
      currency: typeof totals['currency'] === 'string' ? totals['currency'] : 'USD',
      walletId: typeof totals['wallet_id'] === 'string' ? totals['wallet_id'] : null,
      isFrozen: totals['is_frozen'] === true,
      feePercentage: whole(totals, 'fee_percentage'),
      minimumFee: amount(totals, 'minimum_fee'),
      holdDays: whole(totals, 'hold_days'),
      payoutSlaHours: whole(totals, 'payout_sla_hours'),
      payoutThreshold: amount(totals, 'payout_threshold'),
    },
    isDegraded: false,
  };
}
