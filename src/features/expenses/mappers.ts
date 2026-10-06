// src/features/expenses/mappers.ts
// Turning expense rows into the shapes the interface renders.

import type { ExpenseDetail, ExpenseSummary } from '@/features/expenses/types';
import { readAmount, readBoolean, readEnum, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import type { PaymentMethodType } from '@/types/enums';
import { EXPENSE_STATUSES, PAYMENT_METHOD_TYPES } from '@/types/enums';

/**
 * Reads a text field from a joined object such as the supplier.
 *
 * @param row Row returned by the database.
 * @param column Column holding the joined object.
 * @param field Field of that object to read.
 * @returns The value, or null when the join found nothing.
 */
function readJoined(row: DatabaseRow, column: string, field: string): string | null {
  const value = row[column];

  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const inner = (value as Record<string, unknown>)[field];
  return typeof inner === 'string' && inner.length > 0 ? inner : null;
}

/**
 * Reads the payment method, which stays empty until somebody records one.
 *
 * @param row Row read from public.expenses.
 * @returns The method, or null when none was recorded.
 */
function readPaymentMethod(row: DatabaseRow): PaymentMethodType | null {
  const value = row['payment_method'];

  return typeof value === 'string' && PAYMENT_METHOD_TYPES.includes(value as PaymentMethodType)
    ? (value as PaymentMethodType)
    : null;
}

/**
 * Maps one row of the expense list.
 *
 * @param row Row read from public.expenses.
 * @returns The summary the list renders.
 */
export function toExpenseSummary(row: DatabaseRow): ExpenseSummary {
  return {
    id: readString(row, 'id') ?? '',
    expenseNumber: readString(row, 'expense_number') ?? '',
    status: readEnum(row, 'status', EXPENSE_STATUSES, 'draft'),
    description: readString(row, 'description') ?? '',
    expenseDate: readString(row, 'expense_date') ?? '',
    vendorId: readString(row, 'vendor_id'),
    vendorName: readJoined(row, 'vendors', 'display_name'),
    categoryId: readString(row, 'category_id'),
    categoryName: readJoined(row, 'expense_categories', 'name'),
    currency: readString(row, 'currency') ?? 'USD',
    totalAmount: readAmount(row, 'total_amount'),
    isPaid: readBoolean(row, 'is_paid'),
    isBillable: readBoolean(row, 'is_billable'),
    isReimbursable: readBoolean(row, 'is_reimbursable'),
    invoicedAt: readString(row, 'invoiced_at'),
    clientId: readString(row, 'client_id'),
    clientName: readJoined(row, 'clients', 'display_name'),
    isDeleted: readString(row, 'deleted_at') !== null,
  };
}

/**
 * Maps one full expense claim.
 *
 * @param row Row read from public.expenses.
 * @returns The claim shown on its own page.
 */
export function toExpenseDetail(row: DatabaseRow): ExpenseDetail {
  return {
    ...toExpenseSummary(row),
    reference: readString(row, 'reference'),
    subtotalAmount: readAmount(row, 'subtotal_amount'),
    taxAmount: readAmount(row, 'tax_amount'),
    taxRateId: readString(row, 'tax_rate_id'),
    paymentMethod: readPaymentMethod(row),
    paidAt: readString(row, 'paid_at'),
    markupPercentage: readAmount(row, 'markup_percentage'),
    invoiceId: readString(row, 'invoice_id'),
    paidByUserId: readString(row, 'paid_by_user_id'),
    reimbursedAt: readString(row, 'reimbursed_at'),
    receiptFileName: readString(row, 'receipt_file_name'),
    submittedAt: readString(row, 'submitted_at'),
    approvedAt: readString(row, 'approved_at'),
    rejectedAt: readString(row, 'rejected_at'),
    rejectionReason: readString(row, 'rejection_reason'),
    notes: readString(row, 'notes'),
    createdAt: readString(row, 'created_at'),
  };
}
