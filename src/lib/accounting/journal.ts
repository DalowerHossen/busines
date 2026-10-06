import {
  accountUnavailable,
  accountingPeriodLocked,
  invalidAccountingRequest,
  unbalancedJournalEntry,
} from './errors';
import { addAccountingAmounts, compareAccountingAmounts, normalizeAccountingAmount } from './money';
import type {
  AccountingAccount,
  AccountingPeriod,
  JournalEntryInput,
  JournalLine,
  PostedJournalEntry,
} from './types';

export interface JournalEntryStore {
  append(input: PostedJournalEntry): Promise<PostedJournalEntry>;
}

export function validateJournalEntry(input: {
  readonly entry: JournalEntryInput;
  readonly accounts: readonly AccountingAccount[];
  readonly periods: readonly AccountingPeriod[];
}): PostedJournalEntry {
  const { entry } = input;
  validateEntryHeader(entry);
  if (input.periods.some((period) => isDateWithinLockedPeriod(entry.entryDate, period))) {
    throw accountingPeriodLocked();
  }
  const accounts = new Map(input.accounts.map((account) => [account.id, account]));
  const lines: JournalLine[] = entry.lines.map((line) => {
    const account = accounts.get(line.accountId);
    if (!account || account.companyId !== entry.companyId || !account.isActive) {
      throw accountUnavailable();
    }
    const debitAmount = normalizeAccountingAmount(line.debitAmount, { allowZero: true });
    const creditAmount = normalizeAccountingAmount(line.creditAmount, { allowZero: true });
    const debitIsPositive = compareAccountingAmounts(debitAmount, '0') > 0;
    const creditIsPositive = compareAccountingAmounts(creditAmount, '0') > 0;
    if (debitIsPositive === creditIsPositive) throw invalidAccountingRequest();
    return {
      accountId: line.accountId,
      debitAmount,
      creditAmount,
      description: line.description?.trim() || null,
    };
  });
  if (lines.length < 2) throw unbalancedJournalEntry();
  const totalDebitAmount = addAccountingAmounts(...lines.map((line) => line.debitAmount));
  const totalCreditAmount = addAccountingAmounts(...lines.map((line) => line.creditAmount));
  if (compareAccountingAmounts(totalDebitAmount, totalCreditAmount) !== 0) {
    throw unbalancedJournalEntry();
  }
  return {
    companyId: entry.companyId,
    currencyCode: entry.currencyCode,
    entryDate: entry.entryDate,
    description: entry.description.trim(),
    referenceType: entry.referenceType?.trim() || null,
    referenceId: entry.referenceId?.trim() || null,
    createdByUserId: entry.createdByUserId,
    lines,
    totalDebitAmount,
    totalCreditAmount,
    isLocked: false,
  };
}

export async function postJournalEntry(input: {
  readonly store: JournalEntryStore;
  readonly entry: JournalEntryInput;
  readonly accounts: readonly AccountingAccount[];
  readonly periods: readonly AccountingPeriod[];
}): Promise<PostedJournalEntry> {
  const validated = validateJournalEntry({
    entry: input.entry,
    accounts: input.accounts,
    periods: input.periods,
  });
  return input.store.append(validated);
}

function validateEntryHeader(entry: JournalEntryInput): void {
  if (
    !entry.companyId.trim() ||
    !entry.createdByUserId.trim() ||
    !entry.description.trim() ||
    !/^[A-Z]{3}$/u.test(entry.currencyCode) ||
    !isValidCalendarDate(entry.entryDate) ||
    (entry.referenceType !== undefined && !entry.referenceType.trim()) ||
    (entry.referenceId !== undefined && !entry.referenceId.trim())
  ) {
    throw invalidAccountingRequest();
  }
}

function isDateWithinLockedPeriod(date: string, period: AccountingPeriod): boolean {
  if (!isValidCalendarDate(period.startDate) || !isValidCalendarDate(period.endDate)) {
    throw invalidAccountingRequest();
  }
  if (period.endDate < period.startDate) throw invalidAccountingRequest();
  return period.isLocked && date >= period.startDate && date <= period.endDate;
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    date.getUTCFullYear() === Number(value.slice(0, 4)) &&
    date.getUTCMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getUTCDate() === Number(value.slice(8, 10))
  );
}
