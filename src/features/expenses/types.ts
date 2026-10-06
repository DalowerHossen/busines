// src/features/expenses/types.ts
// The shapes the expense module works with: the rows of the list, one full
// claim, and the lists the form needs to offer.

import type { ExpenseStatus, PaymentMethodType } from '@/types/enums';

export interface ExpenseSummary {
  id: string;
  expenseNumber: string;
  status: ExpenseStatus;
  description: string;
  expenseDate: string;
  vendorId: string | null;
  vendorName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  currency: string;
  totalAmount: string;
  isPaid: boolean;
  isBillable: boolean;
  isReimbursable: boolean;
  invoicedAt: string | null;
  clientId: string | null;
  clientName: string | null;
  isDeleted: boolean;
}

export interface ExpenseDetail extends ExpenseSummary {
  reference: string | null;
  subtotalAmount: string;
  taxAmount: string;
  taxRateId: string | null;
  paymentMethod: PaymentMethodType | null;
  paidAt: string | null;
  markupPercentage: string;
  invoiceId: string | null;
  paidByUserId: string | null;
  reimbursedAt: string | null;
  receiptFileName: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string | null;
}

export interface ExpenseListFilters {
  search: string | null;
  status: ExpenseStatus | null;
  vendorId: string | null;
  categoryId: string | null;
  fromDate: string | null;
  toDate: string | null;
  includeDeleted: boolean;
}

export interface ExpenseTotals {
  currency: string;
  /** Everything claimed in the period, whatever its state. */
  totalSpend: string;
  /** Approved spending that has not been paid out yet. */
  awaitingPayment: string;
  /** Billable spending not yet recharged to a client. */
  rechargeable: string;
  /** How many claims are waiting for an answer. */
  awaitingApprovalCount: number;
  totalCount: number;
}

export interface VendorOption {
  id: string;
  name: string;
  currency: string | null;
  defaultCategoryId: string | null;
}

export interface ExpenseCategoryOption {
  id: string;
  name: string;
  taxRateId: string | null;
}

export interface ExpenseClientOption {
  id: string;
  name: string;
}

export interface ExpenseFormData {
  vendors: VendorOption[];
  categories: ExpenseCategoryOption[];
  clients: ExpenseClientOption[];
}
