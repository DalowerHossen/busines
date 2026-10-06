// src/features/accountants/queries/get-company-books.ts
// The books of one business, read the way an accountant reads them: the
// trial balance first, then the trading figures, then what the business owns
// and owes, then the entries that produced all three.

import type {
  CompanyBooks,
  JournalEntrySummary,
  LedgerReportLine,
  TrialBalanceLine,
} from '@/features/accountants/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

/** How many recent entries the ledger view lists. */
const ENTRY_LIMIT = 50;

/**
 * Maps one trial balance line.
 *
 * @param row Row returned by public.trial_balance.
 * @returns The line the table renders.
 */
function toTrialBalanceLine(row: DatabaseRow): TrialBalanceLine {
  return {
    accountCode: readString(row, 'account_code') ?? '',
    accountName: readString(row, 'account_name') ?? '',
    accountType: readString(row, 'account_type') ?? 'asset',
    debitTotal: readAmount(row, 'debit_total'),
    creditTotal: readAmount(row, 'credit_total'),
  };
}

/**
 * Maps one reporting line.
 *
 * @param row Row returned by a ledger report.
 * @returns The line the table renders.
 */
function toReportLine(row: DatabaseRow): LedgerReportLine {
  return {
    section: readString(row, 'section') ?? '',
    accountCode: readString(row, 'account_code') ?? '',
    accountName: readString(row, 'account_name') ?? '',
    amount: readAmount(row, 'amount'),
  };
}

/**
 * Maps one journal entry.
 *
 * @param row Row read from public.journal_entries.
 * @returns The entry the list renders.
 */
function toEntry(row: DatabaseRow): JournalEntrySummary {
  return {
    id: readString(row, 'id') ?? '',
    entryNumber: readString(row, 'entry_number') ?? '',
    entryDate: readString(row, 'entry_date') ?? '',
    status: readString(row, 'status') ?? 'posted',
    memo: readString(row, 'memo'),
    sourceType: readString(row, 'source_type') ?? 'manual',
    currency: readString(row, 'currency') ?? 'USD',
    totalDebit: readAmount(row, 'total_debit'),
  };
}

/**
 * Reads the books of one business for a period.
 *
 * @param companyId Business being worked on.
 * @param periodStart First day of the period, as an ISO date.
 * @param periodEnd Last day of the period, as an ISO date.
 * @returns The books, or null when the business cannot be read.
 */
export async function loadCompanyBooks(
  companyId: string,
  periodStart: string,
  periodEnd: string
): Promise<CompanyBooks | null> {
  const supabase = createServerSupabaseClient();

  const { data: companyData, error: companyError } = await supabase
    .from('companies')
    .select('id, display_name, base_currency')
    .eq('id', companyId)
    .is('deleted_at', null)
    .maybeSingle();

  if (companyError) {
    logger.error('The business behind the books could not be read', companyError, { companyId });

    return null;
  }

  const companyRow = asRow(companyData);

  if (companyRow === null) {
    return null;
  }

  const [trialResult, profitResult, balanceResult, entryResult, checkResult] = await Promise.all([
    supabase.rpc('trial_balance', {
      p_company_id: companyId,
      p_from: periodStart,
      p_to: periodEnd,
    }),
    supabase.rpc('profit_and_loss', {
      p_company_id: companyId,
      p_from: periodStart,
      p_to: periodEnd,
    }),
    supabase.rpc('balance_sheet', { p_company_id: companyId, p_as_of: periodEnd }),
    supabase
      .from('journal_entries')
      .select('id, entry_number, entry_date, status, memo, source_type, currency, total_debit')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('entry_date', { ascending: false })
      .limit(ENTRY_LIMIT),
    supabase.rpc('verify_ledger_balance', { p_company_id: companyId }),
  ]);

  const checkRow = asRows(checkResult.data)[0];

  return {
    companyId,
    displayName: readString(companyRow, 'display_name') ?? '',
    baseCurrency: readString(companyRow, 'base_currency') ?? 'USD',
    periodStart,
    periodEnd,
    trialBalance: asRows(trialResult.data).map(toTrialBalanceLine),
    profitAndLoss: asRows(profitResult.data).map(toReportLine),
    balanceSheet: asRows(balanceResult.data).map(toReportLine),
    entries: asRows(entryResult.data).map(toEntry),
    isBalanced: checkRow === undefined ? true : readBoolean(checkRow, 'is_balanced', true),
    isDegraded:
      trialResult.error !== null ||
      profitResult.error !== null ||
      balanceResult.error !== null ||
      entryResult.error !== null,
  };
}
