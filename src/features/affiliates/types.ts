// src/features/affiliates/types.ts
// The shapes the referral programme works with. Everything here is written
// from the partner's point of view, which is deliberately narrow: traffic,
// earnings and payouts, and never a word about the businesses behind them.

import type { AffiliateStatus, PayoutStatus } from '@/types/enums';

export interface AffiliateProfile {
  id: string;
  userId: string;
  referralCode: string;
  displayName: string;
  status: AffiliateStatus;
  contactEmail: string;
  website: string | null;
  promotionMethod: string | null;
  countryCode: string | null;
  commissionPercentage: string;
  commissionDurationMonths: number | null;
  cookieWindowDays: number;
  minimumPayoutAmount: string;
  payoutCurrency: string;
  rejectionReason: string | null;
  suspensionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface AffiliateSummary {
  clicksLast30Days: number;
  clicksTotal: number;
  signupsTotal: number;
  pendingAmount: string;
  approvedAmount: string;
  reversedAmount: string;
  walletAvailable: string;
  walletPending: string;
  payoutCurrency: string;
  minimumPayoutAmount: string;
}

export interface AffiliateLink {
  id: string;
  slug: string;
  label: string;
  destinationPath: string;
  campaign: string | null;
  clickCount: number;
  signupCount: number;
  isActive: boolean;
}

export interface AffiliateCommission {
  id: string;
  amount: string;
  currency: string;
  commissionPercentage: string;
  baseAmount: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  availableOn: string | null;
  reversedAt: string | null;
  createdAt: string;
}

export interface AffiliatePayout {
  id: string;
  payoutNumber: string | null;
  status: PayoutStatus;
  amount: string;
  feeAmount: string;
  netAmount: string;
  currency: string;
  requestedAt: string;
}

export interface AffiliateClickDay {
  /** Day the visits landed on, as an ISO date. */
  day: string;
  clicks: number;
}

export interface AffiliateWorkspace {
  /** The partner record, or null when this account has not applied. */
  profile: AffiliateProfile | null;
  summary: AffiliateSummary | null;
  links: readonly AffiliateLink[];
  commissions: readonly AffiliateCommission[];
  payouts: readonly AffiliatePayout[];
  recentTraffic: readonly AffiliateClickDay[];
  /** True when part of the workspace could not be read. */
  isDegraded: boolean;
}
