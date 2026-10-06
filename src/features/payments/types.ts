// src/features/payments/types.ts
// The shapes the payment module works with: money received, where it was
// applied, and what is still sitting unallocated.

import type { GatewayProvider, PaymentMethodType, PaymentStatus } from '@/types/enums';

export interface PaymentSummary {
  id: string;
  paymentNumber: string | null;
  status: PaymentStatus;
  methodType: PaymentMethodType;
  provider: GatewayProvider;
  clientId: string | null;
  clientName: string;
  amount: string;
  currency: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  receivedAt: string;
  reference: string | null;
  isManual: boolean;
  isDeleted: boolean;
}

export interface PaymentAllocationRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  amount: string;
  allocatedAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface PaymentDetail extends PaymentSummary {
  gatewayFeeAmount: string;
  netAmount: string;
  refundedAmount: string;
  payerName: string | null;
  payerEmail: string | null;
  bankReference: string | null;
  chequeNumber: string | null;
  notes: string | null;
  valueDate: string | null;
  reconciledAt: string | null;
  createdAt: string | null;
  allocations: PaymentAllocationRecord[];
}

export interface PaymentListFilters {
  /** Free text matched against the reference, the payer and the number. */
  search: string | null;
  /** Client to narrow by, or null for every client. */
  clientId: string | null;
  /** Method to narrow by, or null for every method. */
  methodType: PaymentMethodType | null;
  /** Earliest received date to include. */
  fromDate: string | null;
  /** Latest received date to include. */
  toDate: string | null;
  /** True to list only money that has not been applied to an invoice. */
  onlyUnallocated: boolean;
  /** True to list payments that have been deleted. */
  includeDeleted: boolean;
}

export interface PaymentTotals {
  currency: string;
  receivedThisMonth: string;
  unallocatedTotal: string;
  paymentCount: number;
  unallocatedCount: number;
}

export interface OpenInvoiceOption {
  id: string;
  invoiceNumber: string | null;
  clientId: string;
  clientName: string;
  currency: string;
  balanceDue: string;
  dueDate: string;
}

export interface PaymentFormData {
  invoices: readonly OpenInvoiceOption[];
}

export interface PaymentClientOption {
  id: string;
  name: string;
}
