// src/features/resellers/types.ts
// The shapes the white label programme works with. A partner sees the
// accounts it holds, what they are worth and what it is owed. Nothing in
// these shapes carries a client, an invoice or a document, because a partner
// is never allowed to read inside an account it manages.

import type { ResellerStatus } from '@/types/enums';

export interface ResellerProfile {
  id: string;
  userId: string;
  partnerName: string;
  slug: string;
  status: ResellerStatus;
  contactEmail: string;
  contactPhone: string | null;
  countryCode: string;
  brandName: string | null;
  brandLogoUrl: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  customDomain: string | null;
  customDomainVerifiedAt: string | null;
  hidePlatformBranding: boolean;
  revenueSharePercentage: string;
  marginPercentage: string;
  billingCurrency: string;
  maxSubTenants: number | null;
  subTenantCount: number;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface ResellerStatement {
  activeAccounts: number;
  suspendedAccounts: number;
  retailTotal: string;
  wholesaleTotal: string;
  commissionEarned: string;
  commissionPending: string;
  commissionPaid: string;
  currency: string;
}

export interface ResellerAccount {
  companyId: string;
  displayName: string;
  accountReference: string | null;
  status: string;
  provisionedAt: string;
  lifetimeRetailAmount: string;
  lifetimeCommissionAmount: string;
}

export interface ResellerPayoutRecord {
  id: string;
  payoutReference: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: string | null;
}

export interface ResellerWorkspace {
  /** The partner record, or null when this account has not applied. */
  profile: ResellerProfile | null;
  statement: ResellerStatement | null;
  accounts: readonly ResellerAccount[];
  payouts: readonly ResellerPayoutRecord[];
  /** True when part of the workspace could not be read. */
  isDegraded: boolean;
}
