// src/features/accountants/types.ts
// The shapes the bookkeeping portal works with. An accountant holds one
// login and serves several businesses, so everything here is keyed by the
// business being worked on and nothing is ever mixed together.

export interface AccountantWorkspace {
  companyId: string;
  displayName: string;
  baseCurrency: string;
  grantedAt: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
  scopes: readonly string[];
  outstandingAmount: string;
  overdueAmount: string;
  collectedThisMonth: string;
  expensesThisMonth: string;
  draftEntries: number;
  unreconciledTransactions: number;
}

export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitTotal: string;
  creditTotal: string;
}

export interface LedgerReportLine {
  section: string;
  accountCode: string;
  accountName: string;
  amount: string;
}

export interface JournalEntrySummary {
  id: string;
  entryNumber: string;
  entryDate: string;
  status: string;
  memo: string | null;
  sourceType: string;
  currency: string;
  totalDebit: string;
}

export interface CompanyBooks {
  companyId: string;
  displayName: string;
  baseCurrency: string;
  periodStart: string;
  periodEnd: string;
  trialBalance: readonly TrialBalanceLine[];
  profitAndLoss: readonly LedgerReportLine[];
  balanceSheet: readonly LedgerReportLine[];
  entries: readonly JournalEntrySummary[];
  isBalanced: boolean;
  isDegraded: boolean;
}

export interface AccountantGrant {
  id: string;
  accountantUserId: string;
  fullName: string;
  email: string;
  status: string;
  scopes: readonly string[];
  grantedAt: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
}
