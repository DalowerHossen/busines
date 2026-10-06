// src/features/payouts/types.ts
// The shapes the payout module works with: what the platform owes this
// business, where it should be sent, and what is on the way.

import type { PayoutMethod, PayoutStatus, WalletTransactionType } from '@/types/enums';

export interface WalletBalance {
  id: string;
  currency: string;
  /** Money that can be paid out today. */
  availableBalance: string;
  /** Money received but still inside the hold window. */
  pendingBalance: string;
  /** Money already promised to a payout on its way. */
  reservedBalance: string;
  lifetimeCredited: string;
  lifetimeDebited: string;
  payoutThreshold: string;
  payoutHoldDays: number;
  isPayoutEnabled: boolean;
  isFrozen: boolean;
  frozenReason: string | null;
  lastPayoutAt: string | null;
}

export interface WalletEntry {
  id: string;
  transactionType: WalletTransactionType;
  amount: string;
  currency: string;
  balanceAfter: string;
  description: string;
  isPending: boolean;
  availableFrom: string | null;
  occurredAt: string;
}

export interface PayoutAccount {
  id: string;
  label: string;
  method: PayoutMethod;
  accountHolderName: string;
  /** The only part of the destination kept in clear. */
  accountMask: string | null;
  bankName: string | null;
  currency: string;
  countryCode: string;
  isDefault: boolean;
  isVerified: boolean;
}

export interface PayoutRecord {
  id: string;
  payoutNumber: string | null;
  status: PayoutStatus;
  method: PayoutMethod;
  amount: string;
  feeAmount: string;
  netAmount: string;
  currency: string;
  destinationLabel: string;
  requestedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  rejectionReason: string | null;
  providerReference: string | null;
}

export interface PayoutOverview {
  wallet: WalletBalance | null;
  entries: readonly WalletEntry[];
  accounts: readonly PayoutAccount[];
  payouts: readonly PayoutRecord[];
  /** True when the wallet could not be read. */
  isDegraded: boolean;
}

export interface PaymentRailAccount {
  id: string;
  /** Network the connection belongs to. */
  rail: 'adyen' | 'nium';
  mode: 'test' | 'live';
  status: 'pending' | 'onboarding' | 'active' | 'restricted' | 'suspended' | 'closed';
  statusNote: string | null;
  accountHolderReference: string | null;
  balanceAccountReference: string | null;
  walletReference: string | null;
  defaultCurrency: string;
  countryCode: string;
  /** Share of each payment the platform keeps on this rail. */
  platformFeePercentage: string;
  isReceivingEnabled: boolean;
  isSendingEnabled: boolean;
  onboardingUrl: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

export interface PaymentRailOverview {
  accounts: readonly PaymentRailAccount[];
  /** True when the connections could not be read. */
  isDegraded: boolean;
}
