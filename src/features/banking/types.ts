// src/features/banking/types.ts
// The shapes the reconciliation pages work with: what is connected, what the
// bank has sent, and what might explain each line.

export interface FeedConnectionHealth {
  connectionId: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  consentExpiresAt: string | null;
  daysUntilExpiry: number | null;
  consecutiveFailures: number;
}

export interface FeedAccountRecord {
  feedAccountId: string;
  connectionId: string;
  institutionName: string;
  connectionStatus: string;
  provider: string;
  accountName: string;
  accountMask: string | null;
  accountType: string | null;
  currency: string;
  currentBalance: string | null;
  balanceUpdatedAt: string | null;
  isLinked: boolean;
  isIgnored: boolean;
  bankAccountId: string | null;
  bankAccountName: string | null;
  lastTransactionDate: string | null;
}

export interface BankLineRecord {
  bankTransactionId: string;
  bankAccountId: string;
  bankAccountName: string;
  transactionDate: string;
  amount: string;
  currency: string;
  description: string;
  counterpartyName: string | null;
  reference: string | null;
  status: string;
  importSource: string;
  suggestionCount: number;
  bestConfidence: string;
  rememberedConfidence: string;
}

export interface MatchCandidate {
  recordType: string;
  recordId: string;
  recordLabel: string;
  matchedAmount: string;
  confidence: string;
  matchReason: string;
}

export interface ReconciliationOverview {
  connections: number;
  connectionsNeedingAttention: number;
  linkedAccounts: number;
  unlinkedAccounts: number;
  linesToReview: number;
  valueToReview: string;
  oldestUnreviewedDate: string | null;
  matchedLast30Days: number;
  learnedCounterparties: number;
}

export interface LedgerBankAccountOption {
  id: string;
  name: string;
  currency: string;
}
