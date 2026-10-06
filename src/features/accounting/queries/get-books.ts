// src/features/accounting/queries/get-books.ts
// Reading the books of one business: the accounts, what has been posted to
// them, and whether the whole thing still balances.

import type {
  JournalEntryRow,
  LedgerAccountRow,
  TrialBalanceRow,
} from '@/features/accounting/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface BooksBoard {
  accounts: readonly LedgerAccountRow[];
  entries: readonly JournalEntryRow[];
  trialBalance: readonly TrialBalanceRow[];
  /** Everything debited across the trial balance. */
  totalDebit: string;
  /** Everything credited across the trial balance. */
  totalCredit: string;
  /** True when the two sides agree, which they always should. */
  isBalanced: boolean;
  /** True when something could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the chart of accounts, the recent entries and the trial balance.
 *
 * @param companyId Business being read.
 * @returns The books, and whether they balance.
 */
export async function loadBooksBoard(companyId: string): Promise<BooksBoard> {
  const supabase = createServerSupabaseClient();

  const [accounts, entries, trial] = await Promise.all([
    supabase
      .from('ledger_accounts')
      .select('id, code, name, account_type, is_active, is_system, current_balance')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('code', { ascending: true }),
    supabase
      .from('journal_entries')
      .select(
        'id, entry_number, entry_date, memo, source_type, reference, total_debit, total_credit, status, reversal_of_entry_id'
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('entry_date', { ascending: false })
      .limit(50),
    supabase.rpc('trial_balance', { p_company_id: companyId, p_from: null, p_to: null }),
  ]);

  if (accounts.error || entries.error) {
    logger.error('The books could not be read', accounts.error ?? entries.error, { companyId });

    return {
      accounts: [],
      entries: [],
      trialBalance: [],
      totalDebit: '0',
      totalCredit: '0',
      isBalanced: true,
      isDegraded: true,
    };
  }

  const trialRows = asRows(trial.data).map((row) => ({
    accountCode: readString(row, 'account_code') ?? '',
    accountName: readString(row, 'account_name') ?? '',
    accountType: readString(row, 'account_type') ?? 'asset',
    debitTotal: readAmount(row, 'debit_total'),
    creditTotal: readAmount(row, 'credit_total'),
  }));

  const totalDebit = trialRows.reduce(
    (running, row) => running + Number.parseFloat(row.debitTotal),
    0
  );
  const totalCredit = trialRows.reduce(
    (running, row) => running + Number.parseFloat(row.creditTotal),
    0
  );

  return {
    accounts: asRows(accounts.data).map((row) => ({
      accountId: readString(row, 'id') ?? '',
      code: readString(row, 'code') ?? '',
      name: readString(row, 'name') ?? '',
      accountType: readString(row, 'account_type') ?? 'asset',
      isActive: readBoolean(row, 'is_active'),
      isSystem: readBoolean(row, 'is_system'),
      currentBalance: readAmount(row, 'current_balance'),
    })),
    entries: asRows(entries.data).map((row) => ({
      entryId: readString(row, 'id') ?? '',
      entryNumber: readString(row, 'entry_number'),
      entryDate: readString(row, 'entry_date') ?? '',
      memo: readString(row, 'memo'),
      sourceType: readString(row, 'source_type') ?? 'manual',
      reference: readString(row, 'reference'),
      totalDebit: readAmount(row, 'total_debit'),
      totalCredit: readAmount(row, 'total_credit'),
      isPosted: readString(row, 'status') === 'posted',
      isReversal: readString(row, 'reversal_of_entry_id') !== null,
    })),
    trialBalance: trialRows,
    totalDebit: totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.005,
    isDegraded: false,
  };
}
