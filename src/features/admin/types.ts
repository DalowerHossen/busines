// src/features/admin/types.ts
// The shapes the platform console works with: the state of the platform as a
// whole, and the tenants inside it.

import type { CompanyStatus, KycStatus, SubscriptionStatus } from '@/types/enums';

export interface PlatformOverview {
  tenants: {
    total: number;
    active: number;
    trialing: number;
    suspended: number;
    joinedThisMonth: number;
  };
  accounts: {
    total: number;
    awaitingKyc: number;
  };
  subscriptions: {
    paying: number;
    pastDue: number;
    monthlyRecurringRevenue: string;
  };
  money: {
    collectedThisMonth: string;
    platformFeesThisMonth: string;
    payoutsAwaitingReview: number;
  };
  attention: {
    openDisputes: number;
    refundsAwaitingApproval: number;
  };
  /** True when the figures could not be read. */
  isDegraded: boolean;
}

export interface TenantSummary {
  id: string;
  displayName: string;
  legalName: string;
  slug: string;
  status: CompanyStatus;
  kycStatus: KycStatus;
  countryCode: string;
  baseCurrency: string;
  morEnabled: boolean;
  suspensionReason: string | null;
  createdAt: string;
  planName: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  /** How much the tenant pays for the current interval. */
  planAmount: string | null;
}

export interface TenantListFilters {
  search: string | null;
  status: CompanyStatus | null;
  kycStatus: KycStatus | null;
}

export interface EntitlementOverride {
  id: string;
  entitlementKey: string;
  value: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface TenantOwner {
  id: string;
  fullName: string;
  email: string;
  status: string;
  lastSignInAt: string | null;
}

export interface TenantUsageLine {
  metricKey: string;
  used: number;
  allowance: number | null;
}

export interface TenantDetail {
  tenant: TenantSummary;
  owners: readonly TenantOwner[];
  overrides: readonly EntitlementOverride[];
  usage: readonly TenantUsageLine[];
  counts: {
    users: number;
    clients: number;
    invoices: number;
  };
  totals: {
    invoicedAllTime: string;
    collectedAllTime: string;
    platformFeesAllTime: string;
  };
  /** True when part of the detail could not be read. */
  isDegraded: boolean;
}
