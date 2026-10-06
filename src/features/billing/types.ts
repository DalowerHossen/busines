// src/features/billing/types.ts
// The shapes behind the page where a business manages what it pays the
// platform: its plan, its allowances, its platform invoices.

import type { BillingInterval, InvoiceStatus, SubscriptionStatus } from '@/types/enums';

export interface PlanPrice {
  id: string;
  interval: BillingInterval;
  currency: string;
  amount: string;
  /** Price shown struck through, when the plan is on offer. */
  compareAtAmount: string | null;
}

export interface PlanOption {
  id: string;
  planKey: string;
  name: string;
  tagline: string | null;
  description: string | null;
  isFree: boolean;
  trialDays: number;
  badgeLabel: string | null;
  displayOrder: number;
  /** Limits of the plan; a null value means the plan sets no ceiling. */
  limits: Readonly<Record<string, number | null>>;
  /** Modules the plan unlocks. */
  features: Readonly<Record<string, boolean>>;
  merchantFeePercentage: string;
  merchantFeeFixed: string;
  prices: readonly PlanPrice[];
}

export interface CurrentPlan {
  subscriptionId: string;
  planId: string;
  planKey: string;
  planName: string;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currency: string;
  amount: string;
  discountAmount: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string | null;
  trialEndDate: string | null;
  cancelAtPeriodEnd: boolean;
  cancellationReason: string | null;
  pastDueSince: string | null;
  gracePeriodEndsOn: string | null;
}

export interface UsageMeter {
  metricKey: string;
  periodKey: string;
  used: number;
  /** Null when the plan places no limit on this item. */
  allowance: number | null;
  remaining: number | null;
}

export interface PlatformInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  /** Collection fees the platform kept during the period. */
  merchantFeeAmount: string;
  paidAt: string | null;
}

export interface BillingOverview {
  current: CurrentPlan | null;
  plans: readonly PlanOption[];
  meters: readonly UsageMeter[];
  invoices: readonly PlatformInvoice[];
  /** True when part of the picture could not be read. */
  isDegraded: boolean;
}
