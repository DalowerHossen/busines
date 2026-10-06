// src/features/payments/mappers.ts
// Turning payment rows into the shapes the interface renders.

import type {
  PaymentAllocationRecord,
  PaymentDetail,
  PaymentSummary,
} from '@/features/payments/types';
import { readAmount, readBoolean, readEnum, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import { GATEWAY_PROVIDERS, PAYMENT_METHOD_TYPES, PAYMENT_STATUSES } from '@/types/enums';

/**
 * Reads a text field from a joined object such as the client.
 *
 * @param row Row returned by the database.
 * @param column Column holding the joined object.
 * @param field Field of that object to read.
 * @returns The value, or null when the join found nothing.
 */
function readJoined(row: DatabaseRow, column: string, field: string): string | null {
  const value = row[column];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const inner = (value as Record<string, unknown>)[field];
  return typeof inner === 'string' && inner.length > 0 ? inner : null;
}

/**
 * Maps one row of the payment list.
 *
 * @param row Row read from public.payments.
 * @returns The payment as the list renders it.
 */
export function toPaymentSummary(row: DatabaseRow): PaymentSummary {
  return {
    id: readString(row, 'id') ?? '',
    paymentNumber: readString(row, 'payment_number'),
    status: readEnum(row, 'status', PAYMENT_STATUSES, 'succeeded'),
    methodType: readEnum(row, 'method_type', PAYMENT_METHOD_TYPES, 'bank_transfer'),
    provider: readEnum(row, 'provider', GATEWAY_PROVIDERS, 'manual'),
    clientId: readString(row, 'client_id'),
    clientName: readJoined(row, 'clients', 'display_name') ?? 'No client recorded',
    amount: readAmount(row, 'amount'),
    currency: readString(row, 'currency') ?? 'USD',
    allocatedAmount: readAmount(row, 'allocated_amount'),
    unallocatedAmount: readAmount(row, 'unallocated_amount'),
    receivedAt: readString(row, 'received_at') ?? '',
    reference: readString(row, 'provider_payment_reference') ?? readString(row, 'bank_reference'),
    isManual: readBoolean(row, 'is_manual'),
    isDeleted: readString(row, 'deleted_at') !== null,
  };
}

/**
 * Maps one allocation of a payment.
 *
 * @param row Row read from public.payment_allocations.
 * @returns The allocation record.
 */
export function toPaymentAllocation(row: DatabaseRow): PaymentAllocationRecord {
  return {
    id: readString(row, 'id') ?? '',
    invoiceId: readString(row, 'invoice_id') ?? '',
    invoiceNumber: readJoined(row, 'invoices', 'invoice_number'),
    amount: readAmount(row, 'amount'),
    allocatedAt: readString(row, 'allocated_at') ?? '',
    reversedAt: readString(row, 'reversed_at'),
    reversalReason: readString(row, 'reversal_reason'),
  };
}

/**
 * Maps the full payment shown on its own page.
 *
 * @param row Row read from public.payments.
 * @param allocations Allocations held against the payment.
 * @returns The payment detail record.
 */
export function toPaymentDetail(
  row: DatabaseRow,
  allocations: readonly DatabaseRow[]
): PaymentDetail {
  return {
    ...toPaymentSummary(row),
    gatewayFeeAmount: readAmount(row, 'gateway_fee_amount'),
    netAmount: readAmount(row, 'net_amount'),
    refundedAmount: readAmount(row, 'refunded_amount'),
    payerName: readString(row, 'payer_name'),
    payerEmail: readString(row, 'payer_email'),
    bankReference: readString(row, 'bank_reference'),
    chequeNumber: readString(row, 'cheque_number'),
    notes: readString(row, 'notes'),
    valueDate: readString(row, 'value_date'),
    reconciledAt: readString(row, 'reconciled_at'),
    createdAt: readString(row, 'created_at'),
    allocations: allocations.map((allocation) => toPaymentAllocation(allocation)),
  };
}
