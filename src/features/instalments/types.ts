// src/features/instalments/types.ts
// The shapes the instalment screens work with: the terms a business offers,
// the plans running against them, and what each payment is for.

export interface InstalmentOfferRecord {
  offerId: string;
  name: string;
  provider: string;
  description: string | null;
  instalmentCount: number;
  intervalUnit: string;
  intervalCount: number;
  downPaymentPercentage: string;
  interestRatePercentage: string;
  partnerFeePercentage: string;
  lateFeeAmount: string;
  gracePeriodDays: number;
  minimumInvoiceAmount: string;
  maximumInvoiceAmount: string | null;
  currency: string;
  requiresApproval: boolean;
  isActive: boolean;
  isPlatform: boolean;
  plansRunning: number;
}

export interface InvoiceOfferQuote {
  offerId: string;
  name: string;
  provider: string;
  instalmentCount: number;
  intervalUnit: string;
  intervalCount: number;
  downPaymentAmount: string;
  instalmentAmount: string;
  totalPayable: string;
  requiresApproval: boolean;
}

export interface InstalmentPlanSummary {
  planId: string;
  planReference: string;
  status: string;
  provider: string;
  invoiceId: string;
  invoiceNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  currency: string;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  instalmentCount: number;
  paidCount: number;
  firstDueDate: string;
  finalDueDate: string;
  nextDueDate: string | null;
  overdueCount: number;
  requiresDecision: boolean;
}

export interface InstalmentScheduleItem {
  scheduleItemId: string;
  instalmentNumber: number;
  dueDate: string;
  amount: string;
  principalAmount: string;
  interestAmount: string;
  paidAmount: string;
  lateFeeAmount: string;
  status: string;
  paidAt: string | null;
  lastFailureReason: string | null;
}

export interface InstalmentPlanDetail {
  planId: string;
  planReference: string;
  status: string;
  provider: string;
  invoiceId: string;
  invoiceNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  currency: string;
  totalAmount: string;
  downPaymentAmount: string;
  financedAmount: string;
  interestAmount: string;
  partnerFeeAmount: string;
  netSettlementAmount: string | null;
  paidAmount: string;
  outstandingAmount: string;
  instalmentCount: number;
  paidCount: number;
  firstDueDate: string;
  finalDueDate: string;
  approvalDecision: string | null;
  declinedReason: string | null;
  cancellationReason: string | null;
  defaultedAt: string | null;
  completedAt: string | null;
  schedule: readonly InstalmentScheduleItem[];
}

export interface InstalmentOverview {
  pendingCount: number;
  activeCount: number;
  completedCount: number;
  defaultedCount: number;
  outstandingAmount: string;
  collectedAmount: string;
  overdueInstalments: number;
}
