// src/features/banking/queries/list-feed-accounts.ts
// Reading the connections a business has to its banks, the accounts behind
// them, and which of its own accounts each one feeds.

import type {
  FeedAccountRecord,
  FeedConnectionHealth,
  LedgerBankAccountOption,
} from '@/features/banking/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface FeedAccountResult {
  connections: readonly FeedConnectionHealth[];
  accounts: readonly FeedAccountRecord[];
  ledgerAccounts: readonly LedgerBankAccountOption[];
  /** True when any part of the read failed. */
  isDegraded: boolean;
}

/**
 * Reads the bank feeds of one business.
 *
 * @param companyId Business whose feeds are being read.
 * @returns The connections, the accounts and the ledger accounts to map to.
 */
export async function loadFeedAccounts(companyId: string): Promise<FeedAccountResult> {
  const supabase = createServerSupabaseClient();

  const [health, feeds, ledger] = await Promise.all([
    supabase.rpc('bank_feed_health', { p_company_id: companyId }),
    supabase.rpc('company_feed_accounts', { p_company_id: companyId }),
    supabase
      .from('bank_accounts')
      .select('id, name, currency')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
  ]);

  const isDegraded = Boolean(health.error) || Boolean(feeds.error) || Boolean(ledger.error);

  if (isDegraded) {
    logger.error('The bank feeds could not be read', health.error ?? feeds.error ?? ledger.error, {
      companyId,
    });
  }

  const connections = asRows(health.data).map((row) => ({
    connectionId: readString(row, 'connection_id') ?? '',
    institutionName: readString(row, 'institution_name') ?? '',
    status: readString(row, 'status') ?? 'pending',
    lastSyncedAt: readString(row, 'last_synced_at'),
    consentExpiresAt: readString(row, 'consent_expires_at'),
    daysUntilExpiry: readNumber(row, 'days_until_expiry'),
    consecutiveFailures: readNumber(row, 'consecutive_failures') ?? 0,
  }));

  const accounts = asRows(feeds.data).map((row) => ({
    feedAccountId: readString(row, 'feed_account_id') ?? '',
    connectionId: readString(row, 'connection_id') ?? '',
    institutionName: readString(row, 'institution_name') ?? '',
    connectionStatus: readString(row, 'connection_status') ?? 'pending',
    provider: readString(row, 'provider') ?? '',
    accountName: readString(row, 'account_name') ?? '',
    accountMask: readString(row, 'account_mask'),
    accountType: readString(row, 'account_type'),
    currency: readString(row, 'currency') ?? 'USD',
    currentBalance: readString(row, 'current_balance'),
    balanceUpdatedAt: readString(row, 'balance_updated_at'),
    isLinked: readBoolean(row, 'is_linked') ?? false,
    isIgnored: readBoolean(row, 'is_ignored') ?? false,
    bankAccountId: readString(row, 'bank_account_id'),
    bankAccountName: readString(row, 'bank_account_name'),
    lastTransactionDate: readString(row, 'last_transaction_date'),
  }));

  const ledgerAccounts = asRows(ledger.data).map((row) => ({
    id: readString(row, 'id') ?? '',
    name: readString(row, 'name') ?? '',
    currency: readString(row, 'currency') ?? 'USD',
  }));

  return { connections, accounts, ledgerAccounts, isDegraded };
}
