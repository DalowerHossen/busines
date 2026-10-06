// src/features/settlements/types.ts
// The shapes the earnings screens work with: what each payment became and
// what the account is holding overall.

export interface SettlementRecord {
  settlementId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  currency: string;
  grossAmount: string;
  gatewayFeeAmount: string;
  platformFeeAmount: string;
  netAmount: string;
  status: string;
  holdUntil: string;
  releasedAt: string | null;
  paidOutAt: string | null;
  createdAt: string;
}

export interface SettlementSummary {
  heldAmount: string;
  availableAmount: string;
  paidOutAmount: string;
  feesPaid: string;
  nextReleaseDate: string | null;
  currency: string;
  walletId: string | null;
  isFrozen: boolean;
  feePercentage: number;
  minimumFee: string;
  holdDays: number;
  payoutSlaHours: number;
  payoutThreshold: string;
}

export interface FeeQuote {
  grossAmount: string;
  gatewayFeeAmount: string;
  platformFeePercentage: number;
  platformFeeAmount: string;
  netAmount: string;
  holdDays: number;
  payoutSlaHours: number;
}
