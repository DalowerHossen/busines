import { invalidAccountingRequest } from './errors';
import {
  addSignedAccountingAmounts,
  compareAccountingAmounts,
  normalizeAccountingAmount,
} from './money';
import { isValidCalendarDate } from './journal';
import type { AccountType } from '@/types/accounting';
import type {
  AccountingAccount,
  BalanceSheetStatement,
  CashFlowCategory,
  CashFlowStatement,
  PostedJournalEntry,
  ProfitAndLossStatement,
  StatementLine,
  StatementPeriod,
} from './types';

export function calculateProfitAndLoss(input: {
  readonly companyId: string;
  readonly currencyCode: string;
  readonly period: StatementPeriod;
  readonly entries: readonly PostedJournalEntry[];
  readonly accounts: readonly AccountingAccount[];
  readonly cogsAccountIds?: ReadonlySet<string>;
}): ProfitAndLossStatement {
  validateStatementInput(input.companyId, input.currencyCode, input.period);
  const accountBalances = buildAccountBalances({
    companyId: input.companyId,
    currencyCode: input.currencyCode,
    entries: input.entries,
    accounts: input.accounts,
    period: input.period,
  });
  const lines = accountBalances.filter(
    (line) => line.accountType === 'revenue' || line.accountType === 'expense'
  );
  const revenue = sumLines(lines, 'revenue');
  const totalExpenses = sumLines(lines, 'expense');
  const cogs = sumLines(
    lines.filter((line) => input.cogsAccountIds?.has(line.accountId) ?? false),
    'expense'
  );
  const operatingExpenses = addSignedAccountingAmounts(`-${cogs}`, totalExpenses);
  return {
    currencyCode: input.currencyCode,
    period: input.period,
    lines,
    revenue,
    costOfGoodsSold: cogs,
    operatingExpenses,
    totalExpenses,
    netProfit: addSignedAccountingAmounts(`-${totalExpenses}`, revenue),
  };
}

export function calculateCostOfGoodsSold(input: {
  readonly companyId: string;
  readonly currencyCode: string;
  readonly period: StatementPeriod;
  readonly entries: readonly PostedJournalEntry[];
  readonly accounts: readonly AccountingAccount[];
  readonly cogsAccountIds: ReadonlySet<string>;
}): string {
  return calculateProfitAndLoss(input).costOfGoodsSold;
}

export function calculateBalanceSheet(input: {
  readonly companyId: string;
  readonly currencyCode: string;
  readonly asOfDate: string;
  readonly profitAndLossPeriod: StatementPeriod;
  readonly entries: readonly PostedJournalEntry[];
  readonly accounts: readonly AccountingAccount[];
}): BalanceSheetStatement {
  if (!isValidCalendarDate(input.asOfDate) || input.profitAndLossPeriod.endDate > input.asOfDate) {
    throw invalidAccountingRequest();
  }
  validateStatementInput(input.companyId, input.currencyCode, input.profitAndLossPeriod);
  const accountBalances = buildAccountBalances({
    companyId: input.companyId,
    currencyCode: input.currencyCode,
    entries: input.entries,
    accounts: input.accounts,
    asOfDate: input.asOfDate,
  });
  const assets = accountBalances.filter((line) => line.accountType === 'asset');
  const liabilities = accountBalances.filter((line) => line.accountType === 'liability');
  const equity = accountBalances.filter((line) => line.accountType === 'equity');
  const totalAssets = sumStatementLines(assets);
  const totalLiabilities = sumStatementLines(liabilities);
  const contributedEquity = sumStatementLines(equity);
  const currentPeriodProfit = calculateProfitAndLoss({
    companyId: input.companyId,
    currencyCode: input.currencyCode,
    period: input.profitAndLossPeriod,
    entries: input.entries,
    accounts: input.accounts,
  }).netProfit;
  const totalEquity = addSignedAccountingAmounts(contributedEquity, currentPeriodProfit);
  const totalLiabilitiesAndEquity = addSignedAccountingAmounts(totalLiabilities, totalEquity);
  return {
    currencyCode: input.currencyCode,
    asOfDate: input.asOfDate,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    contributedEquity,
    currentPeriodProfit,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced: compareAccountingAmounts(totalAssets, totalLiabilitiesAndEquity) === 0,
  };
}

export function calculateCashFlow(input: {
  readonly companyId: string;
  readonly currencyCode: string;
  readonly period: StatementPeriod;
  readonly entries: readonly PostedJournalEntry[];
  readonly cashAccountIds: ReadonlySet<string>;
  readonly categoryByCounterpartAccountId: Readonly<Record<string, CashFlowCategory>>;
  readonly openingCashBalance: string;
}): CashFlowStatement {
  validateStatementInput(input.companyId, input.currencyCode, input.period);
  const openingCashBalance = normalizeAccountingAmount(input.openingCashBalance, {
    allowNegative: true,
    allowZero: true,
  });
  let operating = '0.0000';
  let investing = '0.0000';
  let financing = '0.0000';
  for (const entry of input.entries) {
    validateEntryCurrency(entry, input.companyId, input.currencyCode);
    if (entry.entryDate < input.period.startDate || entry.entryDate > input.period.endDate)
      continue;
    const cashLines = entry.lines.filter((line) => input.cashAccountIds.has(line.accountId));
    if (cashLines.length === 0) continue;
    const counterpartLines = entry.lines.filter(
      (line) => !input.cashAccountIds.has(line.accountId)
    );
    const counterpartCategories = new Set(
      counterpartLines.map((line) => input.categoryByCounterpartAccountId[line.accountId])
    );
    if (counterpartCategories.size !== 1 || counterpartCategories.has(undefined)) {
      throw invalidAccountingRequest();
    }
    const category = [...counterpartCategories][0];
    const movement = cashLines.reduce(
      (total, line) => addSignedAccountingAmounts(total, line.debitAmount, `-${line.creditAmount}`),
      '0.0000'
    );
    if (category === 'operating') operating = addSignedAccountingAmounts(operating, movement);
    if (category === 'investing') investing = addSignedAccountingAmounts(investing, movement);
    if (category === 'financing') financing = addSignedAccountingAmounts(financing, movement);
  }
  const netCashChange = addSignedAccountingAmounts(operating, investing, financing);
  return {
    currencyCode: input.currencyCode,
    period: input.period,
    operating,
    investing,
    financing,
    netCashChange,
    openingCashBalance,
    closingCashBalance: addSignedAccountingAmounts(openingCashBalance, netCashChange),
  };
}

function buildAccountBalances(input: {
  readonly companyId: string;
  readonly currencyCode: string;
  readonly entries: readonly PostedJournalEntry[];
  readonly accounts: readonly AccountingAccount[];
  readonly period?: StatementPeriod;
  readonly asOfDate?: string;
}): StatementLine[] {
  const accountMap = new Map(input.accounts.map((account) => [account.id, account]));
  const balances = new Map<string, string>();
  for (const entry of input.entries) {
    validateEntryCurrency(entry, input.companyId, input.currencyCode);
    if (
      (input.period &&
        (entry.entryDate < input.period.startDate || entry.entryDate > input.period.endDate)) ||
      (input.asOfDate && entry.entryDate > input.asOfDate)
    ) {
      continue;
    }
    for (const line of entry.lines) {
      const account = accountMap.get(line.accountId);
      if (!account || !account.isActive) throw invalidAccountingRequest();
      const balance = normalBalance(account.accountType, line.debitAmount, line.creditAmount);
      balances.set(
        line.accountId,
        addSignedAccountingAmounts(balances.get(line.accountId) ?? '0', balance)
      );
    }
  }
  return input.accounts
    .map((account) => ({
      accountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      balance: balances.get(account.id) ?? '0.0000',
    }))
    .filter((line) => compareAccountingAmounts(line.balance, '0') !== 0);
}

function normalBalance(accountType: AccountType, debit: string, credit: string): string {
  if (accountType === 'asset' || accountType === 'expense') {
    return addSignedAccountingAmounts(debit, `-${credit}`);
  }
  return addSignedAccountingAmounts(credit, `-${debit}`);
}

function sumLines(lines: readonly StatementLine[], accountType: AccountType): string {
  return sumStatementLines(lines.filter((line) => line.accountType === accountType));
}

function sumStatementLines(lines: readonly StatementLine[]): string {
  return lines.reduce((total, line) => addSignedAccountingAmounts(total, line.balance), '0.0000');
}

function validateStatementInput(
  companyId: string,
  currencyCode: string,
  period: StatementPeriod
): void {
  if (
    !companyId.trim() ||
    !/^[A-Z]{3}$/u.test(currencyCode) ||
    !isValidCalendarDate(period.startDate) ||
    !isValidCalendarDate(period.endDate) ||
    period.endDate < period.startDate
  ) {
    throw invalidAccountingRequest();
  }
}

function validateEntryCurrency(
  entry: PostedJournalEntry,
  companyId: string,
  currencyCode: string
): void {
  if (entry.companyId !== companyId || entry.currencyCode !== currencyCode) {
    throw invalidAccountingRequest();
  }
}
