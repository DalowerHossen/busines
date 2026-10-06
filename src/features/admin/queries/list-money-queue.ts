// src/features/admin/queries/list-money-queue.ts
// Everything on the platform that is waiting for a decision about money:
// payouts asking to be released, refunds asking to be approved, and the
// chargebacks still open against a tenant.

import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readEnum, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import {
  DISPUTE_STATUSES,
  PAYOUT_METHODS,
  PAYOUT_STATUSES,
  REFUND_STATUSES,
  type DisputeStatus,
  type PayoutMethod,
  type PayoutStatus,
  type RefundStatus,
} from '@/types/enums';

export interface PendingPayout {
  id: string;
  payoutNumber: string | null;
  companyName: string;
  companyId: string;
  status: PayoutStatus;
  method: PayoutMethod;
  amount: string;
  feeAmount: string;
  netAmount: string;
  currency: string;
  destinationLabel: string;
  isVerifiedDestination: boolean;
  requestedAt: string;
}

export interface PendingRefund {
  id: string;
  refundNumber: string | null;
  companyName: string;
  status: RefundStatus;
  amount: string;
  currency: string;
  reason: string;
  requestedAt: string;
}

export interface OpenDispute {
  id: string;
  companyName: string;
  status: DisputeStatus;
  caseNumber: string | null;
  disputedAmount: string;
  currency: string;
  openedAt: string;
  evidenceDueAt: string | null;
}

export interface MoneyQueue {
  payouts: readonly PendingPayout[];
  refunds: readonly PendingRefund[];
  disputes: readonly OpenDispute[];
  /** True when part of the queue could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the business name off a joined company row.
 *
 * @param row Row carrying the join.
 * @param key Name of the joined relation.
 * @returns The business name, or a readable fallback.
 */
function companyName(row: DatabaseRow, key: string): string {
  const joined = asRow(row[key]);

  return joined === null
    ? 'Unknown business'
    : (readString(joined, 'display_name') ?? 'Unknown business');
}

/**
 * Maps one payout waiting for a decision.
 *
 * @param row Row read from public.payouts.
 * @returns The payout the queue renders.
 */
function toPendingPayout(row: DatabaseRow): PendingPayout {
  const wallet = asRow(row['wallets']);
  const account = asRow(row['payout_accounts']);
  const label = account === null ? 'No destination saved' : (readString(account, 'label') ?? '');
  const mask = account === null ? null : readString(account, 'account_mask');

  return {
    id: readString(row, 'id') ?? '',
    payoutNumber: readString(row, 'payout_number'),
    companyName: wallet === null ? 'Unknown business' : companyName(wallet, 'companies'),
    companyId: wallet === null ? '' : (readString(wallet, 'company_id') ?? ''),
    status: readEnum(row, 'status', PAYOUT_STATUSES, 'requested'),
    method: readEnum(row, 'method', PAYOUT_METHODS, 'bank_transfer'),
    amount: readAmount(row, 'amount'),
    feeAmount: readAmount(row, 'fee_amount'),
    netAmount: readAmount(row, 'net_amount'),
    currency: readString(row, 'currency') ?? 'USD',
    destinationLabel: mask === null ? label : `${label} (${mask})`,
    isVerifiedDestination: account !== null && account['is_verified'] === true,
    requestedAt: readString(row, 'requested_at') ?? '',
  };
}

/**
 * Maps one refund waiting for approval.
 *
 * @param row Row read from public.refunds.
 * @returns The refund the queue renders.
 */
function toPendingRefund(row: DatabaseRow): PendingRefund {
  return {
    id: readString(row, 'id') ?? '',
    refundNumber: readString(row, 'refund_number'),
    companyName: companyName(row, 'companies'),
    status: readEnum(row, 'status', REFUND_STATUSES, 'requested'),
    amount: readAmount(row, 'amount'),
    currency: readString(row, 'currency') ?? 'USD',
    reason: readString(row, 'reason') ?? '',
    requestedAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Maps one open chargeback.
 *
 * @param row Row read from public.disputes.
 * @returns The dispute the queue renders.
 */
function toOpenDispute(row: DatabaseRow): OpenDispute {
  return {
    id: readString(row, 'id') ?? '',
    companyName: companyName(row, 'companies'),
    status: readEnum(row, 'status', DISPUTE_STATUSES, 'open'),
    caseNumber: readString(row, 'case_number'),
    disputedAmount: readAmount(row, 'disputed_amount'),
    currency: readString(row, 'currency') ?? 'USD',
    openedAt: readString(row, 'opened_at') ?? '',
    evidenceDueAt: readString(row, 'evidence_due_at'),
  };
}

/**
 * Reads everything waiting for a money decision on the platform.
 *
 * @returns The three queues the console works through.
 */
export async function loadMoneyQueue(): Promise<MoneyQueue> {
  const supabase = createServerSupabaseClient();

  const [payoutResult, refundResult, disputeResult] = await Promise.all([
    supabase
      .from('payouts')
      .select(
        'id, payout_number, status, method, amount, fee_amount, net_amount, currency, requested_at, wallets(company_id, companies(display_name)), payout_accounts(label, account_mask, is_verified)'
      )
      .in('status', ['requested', 'under_review'])
      .is('deleted_at', null)
      .order('requested_at', { ascending: true })
      .limit(100),
    supabase
      .from('refunds')
      .select(
        'id, refund_number, status, amount, currency, reason, created_at, companies(display_name)'
      )
      .eq('approval_status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(100),
    supabase
      .from('disputes')
      .select(
        'id, status, case_number, disputed_amount, currency, opened_at, evidence_due_at, companies(display_name)'
      )
      .in('status', ['open', 'evidence_required', 'evidence_submitted', 'under_review'])
      .is('deleted_at', null)
      .order('evidence_due_at', { ascending: true, nullsFirst: false })
      .limit(100),
  ]);

  const isDegraded =
    Boolean(payoutResult.error) || Boolean(refundResult.error) || Boolean(disputeResult.error);

  if (isDegraded) {
    logger.error(
      'The money queue could not be read in full',
      payoutResult.error ?? refundResult.error ?? disputeResult.error
    );
  }

  return {
    payouts: asRows(payoutResult.data).map(toPendingPayout),
    refunds: asRows(refundResult.data).map(toPendingRefund),
    disputes: asRows(disputeResult.data).map(toOpenDispute),
    isDegraded,
  };
}
