// src/features/accounting/types.ts
// The shapes the accounting screens work with.

export interface LedgerAccountRow {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  isActive: boolean;
  isSystem: boolean;
  currentBalance: string;
}

export interface JournalEntryRow {
  entryId: string;
  entryNumber: string | null;
  entryDate: string;
  memo: string | null;
  sourceType: string;
  reference: string | null;
  totalDebit: string;
  totalCredit: string;
  isPosted: boolean;
  isReversal: boolean;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitTotal: string;
  creditTotal: string;
}
