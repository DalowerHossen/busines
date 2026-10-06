// src/features/payouts/queries/get-wallet.ts
// Reading what the platform owes one business: the balance, how it got
// there, where it can be sent and what is already on its way.

import type {
  PayoutAccount,
  PayoutOverview,
  PayoutRecord,
  WalletBalance,
  WalletEntry,
} from '@/features/payouts/types';
import { logger } from '@/lib/logger';
import {
  asRow,
  asRows,
  readAmount,
  readBoolean,
  readEnum,
  readNumber,
  readString,
} from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { PAYOUT_METHODS, PAYOUT_STATUSES, WALLET_TRANSACTION_TYPES } from '@/types/enums';

/** How many ledger entries the statement shows at once. */
const STATEMENT_LIMIT = 100;

/**
 * Maps the wallet row.
 *
 * @param row Row read from public.wallets.
 * @returns The balance the page renders.
 */
function toWallet(row: DatabaseRow): WalletBalance {
  return {
    id: readString(row, 'id') ?? '',
    currency: readString(row, 'currency') ?? 'USD',
    availableBalance: readAmount(row, 'available_balance'),
    pendingBalance: readAmount(row, 'pending_balance'),
    reservedBalance: readAmount(row, 'reserved_balance'),
    lifetimeCredited: readAmount(row, 'lifetime_credited'),
    lifetimeDebited: readAmount(row, 'lifetime_debited'),
    payoutThreshold: readAmount(row, 'payout_threshold'),
    payoutHoldDays: readNumber(row, 'payout_hold_days') ?? 7,
    isPayoutEnabled: readBoolean(row, 'is_payout_enabled', true),
    isFrozen: readBoolean(row, 'is_frozen'),
    frozenReason: readString(row, 'frozen_reason'),
    lastPayoutAt: readString(row, 'last_payout_at'),
  };
}

/**
 * Maps one ledger entry.
 *
 * @param row Row read from public.wallet_transactions.
 * @returns The entry the statement renders.
 */
function toEntry(row: DatabaseRow): WalletEntry {
  return {
    id: readString(row, 'id') ?? '',
    transactionType: readEnum(row, 'transaction_type', WALLET_TRANSACTION_TYPES, 'adjustment'),
    amount: readAmount(row, 'amount'),
    currency: readString(row, 'currency') ?? 'USD',
    balanceAfter: readAmount(row, 'balance_after'),
    description: readString(row, 'description') ?? '',
    isPending: readBoolean(row, 'is_pending'),
    availableFrom: readString(row, 'available_from'),
    occurredAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Maps one destination the money can be sent to.
 *
 * @param row Row read from public.payout_accounts.
 * @returns The destination the page renders.
 */
function toAccount(row: DatabaseRow): PayoutAccount {
  return {
    id: readString(row, 'id') ?? '',
    label: readString(row, 'label') ?? '',
    method: readEnum(row, 'method', PAYOUT_METHODS, 'bank_transfer'),
    accountHolderName: readString(row, 'account_holder_name') ?? '',
    accountMask: readString(row, 'account_mask'),
    bankName: readString(row, 'bank_name'),
    currency: readString(row, 'currency') ?? 'USD',
    countryCode: readString(row, 'country_code') ?? 'US',
    isDefault: readBoolean(row, 'is_default'),
    isVerified: readBoolean(row, 'is_verified'),
  };
}

/**
 * Maps one payout.
 *
 * @param row Row read from public.payouts.
 * @param accounts Destinations, so the payout can name where it went.
 * @returns The payout the page renders.
 */
function toPayout(row: DatabaseRow, accounts: readonly PayoutAccount[]): PayoutRecord {
  const accountId = readString(row, 'payout_account_id');
  const account = accounts.find((candidate) => candidate.id === accountId);

  return {
    id: readString(row, 'id') ?? '',
    payoutNumber: readString(row, 'payout_number'),
    status: readEnum(row, 'status', PAYOUT_STATUSES, 'requested'),
    method: readEnum(row, 'method', PAYOUT_METHODS, 'bank_transfer'),
    amount: readAmount(row, 'amount'),
    feeAmount: readAmount(row, 'fee_amount'),
    netAmount: readAmount(row, 'net_amount'),
    currency: readString(row, 'currency') ?? 'USD',
    destinationLabel: account
      ? `${account.label}${account.accountMask ? ` (${account.accountMask})` : ''}`
      : 'No destination saved',
    requestedAt: readString(row, 'requested_at') ?? '',
    completedAt: readString(row, 'completed_at'),
    failureReason: readString(row, 'failure_reason'),
    rejectionReason: readString(row, 'rejection_reason'),
    providerReference: readString(row, 'provider_reference'),
  };
}

/**
 * Reads everything the payouts page shows for one business.
 *
 * @param companyId Company whose wallet is read.
 * @returns The wallet, its statement, its destinations and its payouts.
 */
export async function loadPayoutOverview(companyId: string): Promise<PayoutOverview> {
  const supabase = createServerSupabaseClient();

  const { data: walletData, error: walletError } = await supabase
    .from('wallets')
    .select(
      'id, currency, available_balance, pending_balance, reserved_balance, lifetime_credited, lifetime_debited, payout_threshold, payout_hold_days, is_payout_enabled, is_frozen, frozen_reason, last_payout_at'
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle();

  const walletRow = asRow(walletData);

  if (walletError) {
    logger.error('The wallet could not be read', walletError, { companyId });

    return { wallet: null, entries: [], accounts: [], payouts: [], isDegraded: true };
  }

  if (walletRow === null) {
    return { wallet: null, entries: [], accounts: [], payouts: [], isDegraded: false };
  }

  const wallet = toWallet(walletRow);

  const [entryResult, accountResult, payoutResult] = await Promise.all([
    supabase
      .from('wallet_transactions')
      .select(
        'id, transaction_type, amount, currency, balance_after, description, is_pending, available_from, created_at'
      )
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(STATEMENT_LIMIT),
    supabase
      .from('payout_accounts')
      .select(
        'id, label, method, account_holder_name, account_mask, bank_name, currency, country_code, is_default, is_verified'
      )
      .eq('wallet_id', wallet.id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('label', { ascending: true }),
    supabase
      .from('payouts')
      .select(
        'id, payout_number, status, method, amount, fee_amount, net_amount, currency, payout_account_id, requested_at, completed_at, failure_reason, rejection_reason, provider_reference'
      )
      .eq('wallet_id', wallet.id)
      .is('deleted_at', null)
      .order('requested_at', { ascending: false })
      .limit(50),
  ]);

  const accounts = asRows(accountResult.data).map(toAccount);

  return {
    wallet,
    entries: asRows(entryResult.data).map(toEntry),
    accounts,
    payouts: asRows(payoutResult.data).map((row) => toPayout(row, accounts)),
    isDegraded: false,
  };
}
