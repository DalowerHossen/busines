import type { AccountType } from '@/types/accounting';

export interface AccountingAccount {
  readonly id: string;
  readonly companyId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: AccountType;
  readonly isActive: boolean;
}

export interface AccountingPeriod {
  readonly startDate: string;
  readonly endDate: string;
  readonly isLocked: boolean;
}

export interface JournalLineInput {
  readonly accountId: string;
  readonly debitAmount: string;
  readonly creditAmount: string;
  readonly description?: string;
}

export interface JournalEntryInput {
  readonly companyId: string;
  readonly currencyCode: string;
  readonly entryDate: string;
  readonly description: string;
  readonly referenceType?: string;
  readonly referenceId?: string;
  readonly createdByUserId: string;
  readonly lines: readonly JournalLineInput[];
}

export interface JournalLine {
  readonly accountId: string;
  readonly debitAmount: string;
  readonly creditAmount: string;
  readonly description: string | null;
}

export interface PostedJournalEntry {
  readonly companyId: string;
  readonly currencyCode: string;
  readonly entryDate: string;
  readonly description: string;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly createdByUserId: string;
  readonly lines: readonly JournalLine[];
  readonly totalDebitAmount: string;
  readonly totalCreditAmount: string;
  readonly isLocked: boolean;
}

export interface StatementPeriod {
  readonly startDate: string;
  readonly endDate: string;
}

export interface StatementLine {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: AccountType;
  readonly balance: string;
}

export interface ProfitAndLossStatement {
  readonly currencyCode: string;
  readonly period: StatementPeriod;
  readonly lines: readonly StatementLine[];
  readonly revenue: string;
  readonly costOfGoodsSold: string;
  readonly operatingExpenses: string;
  readonly totalExpenses: string;
  readonly netProfit: string;
}

export interface BalanceSheetStatement {
  readonly currencyCode: string;
  readonly asOfDate: string;
  readonly assets: readonly StatementLine[];
  readonly liabilities: readonly StatementLine[];
  readonly equity: readonly StatementLine[];
  readonly totalAssets: string;
  readonly totalLiabilities: string;
  readonly contributedEquity: string;
  readonly currentPeriodProfit: string;
  readonly totalEquity: string;
  readonly totalLiabilitiesAndEquity: string;
  readonly isBalanced: boolean;
}

export type CashFlowCategory = 'operating' | 'investing' | 'financing';

export interface CashFlowStatement {
  readonly currencyCode: string;
  readonly period: StatementPeriod;
  readonly operating: string;
  readonly investing: string;
  readonly financing: string;
  readonly netCashChange: string;
  readonly openingCashBalance: string;
  readonly closingCashBalance: string;
}

export interface BankTransactionForMatching {
  readonly id: string;
  readonly companyId: string;
  readonly transactionDate: string;
  readonly description: string;
  readonly amount: string;
  readonly isReconciled: boolean;
}

export type MatchCandidateType = 'payment' | 'expense' | 'bill' | 'income';

export interface BankMatchCandidate {
  readonly id: string;
  readonly companyId: string;
  readonly candidateType: MatchCandidateType;
  readonly transactionDate: string;
  readonly description: string;
  readonly amount: string;
}

export interface BankMatchingRuleInput {
  readonly id: string;
  readonly companyId: string;
  readonly matchField: 'description' | 'amount';
  readonly matchPattern: string;
  readonly isActive: boolean;
}

export interface BankMatchSuggestion {
  readonly candidate: BankMatchCandidate;
  readonly confidence: number;
  readonly matchedBy: readonly ('amount' | 'description' | 'rule')[];
}

export interface BankReconciliationDecision {
  readonly bankTransactionId: string;
  readonly candidateId: string;
  readonly candidateType: MatchCandidateType;
  readonly status: 'reconciled';
  readonly amount: string;
  readonly reconciledByUserId: string | null;
  readonly reconciledAt: string;
}

export interface ReceiptOcrRequest {
  readonly companyId: string;
  readonly providerFileId: string;
  readonly mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  readonly sizeBytes: number;
  readonly contentSha256: string;
  readonly requestedByUserId: string;
}

export interface ReceiptOcrLineItem {
  readonly description: string;
  readonly quantity: string | null;
  readonly unitPrice: string | null;
  readonly total: string | null;
}

export interface ReceiptOcrResult {
  readonly providerId: string;
  readonly providerRequestId: string;
  readonly vendorName: string | null;
  readonly receiptDate: string | null;
  readonly currencyCode: string | null;
  readonly subtotalAmount: string | null;
  readonly taxAmount: string | null;
  readonly totalAmount: string | null;
  readonly confidence: string;
  readonly lineItems: readonly ReceiptOcrLineItem[];
}

export interface ReceiptOcrAdapter {
  readonly providerId: string;
  extract(input: ReceiptOcrRequest): Promise<ReceiptOcrResult>;
}

export interface ReceiptOcrStore {
  findByContentHash(input: {
    readonly companyId: string;
    readonly contentSha256: string;
  }): Promise<ReceiptOcrResult | null>;
  create(input: {
    readonly request: ReceiptOcrRequest;
    readonly result: ReceiptOcrResult;
  }): Promise<ReceiptOcrResult>;
}
