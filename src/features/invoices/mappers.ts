// src/features/invoices/mappers.ts
// Turning invoice rows into the shapes the interface renders.

import type {
  InvoiceDetail,
  InvoiceLine,
  InvoiceParty,
  InvoiceSummary,
} from '@/features/invoices/types';
import { readAmount, readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import { INVOICE_STATUSES } from '@/types/enums';

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
 * Reads one text field of the frozen billing party.
 *
 * @param source The bill_to object stored on the invoice.
 * @param field Field to read.
 * @returns The value, or null when it was not captured.
 */
function readParty(source: Record<string, unknown>, field: string): string | null {
  const value = source[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Maps the frozen billing party of an invoice.
 *
 * @param row Row read from public.invoices.
 * @returns The party the invoice is addressed to.
 */
export function toInvoiceParty(row: DatabaseRow): InvoiceParty {
  const raw = row['bill_to'];
  const source =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    name: readParty(source, 'name'),
    attentionTo: readParty(source, 'attention_to'),
    email: readParty(source, 'email'),
    phone: readParty(source, 'phone'),
    taxId: readParty(source, 'tax_id'),
    addressLine1: readParty(source, 'address_line1'),
    addressLine2: readParty(source, 'address_line2'),
    city: readParty(source, 'city'),
    stateRegion: readParty(source, 'state_region'),
    postalCode: readParty(source, 'postal_code'),
    countryCode: readParty(source, 'country_code'),
  };
}

/**
 * Maps one row of the invoice list.
 *
 * @param row Row read from public.invoices.
 * @returns The invoice as the list renders it.
 */
export function toInvoiceSummary(row: DatabaseRow): InvoiceSummary {
  const snapshot = readString(row, 'client_name_snapshot');

  return {
    id: readString(row, 'id') ?? '',
    invoiceNumber: readString(row, 'invoice_number'),
    status: readEnum(row, 'status', INVOICE_STATUSES, 'draft'),
    clientId: readString(row, 'client_id') ?? '',
    clientName: snapshot ?? readJoined(row, 'clients', 'display_name') ?? 'Client removed',
    currency: readString(row, 'currency') ?? 'USD',
    issueDate: readString(row, 'issue_date') ?? '',
    dueDate: readString(row, 'due_date') ?? '',
    totalAmount: readAmount(row, 'total_amount'),
    paidAmount: readAmount(row, 'paid_amount'),
    balanceDue: readAmount(row, 'balance_due'),
    isLocked: readBoolean(row, 'is_locked'),
    isDeleted: readString(row, 'deleted_at') !== null,
  };
}

/**
 * Maps one line of an invoice.
 *
 * @param row Row read from public.invoice_items.
 * @returns The line as the document renders it.
 */
export function toInvoiceLine(row: DatabaseRow): InvoiceLine {
  return {
    id: readString(row, 'id') ?? '',
    lineNumber: readNumber(row, 'line_number') ?? 1,
    description: readString(row, 'description') ?? '',
    longDescription: readString(row, 'long_description'),
    quantity: readAmount(row, 'quantity', '1'),
    unitLabel: readString(row, 'unit_label'),
    unitPrice: readAmount(row, 'unit_price'),
    discountValue: readAmount(row, 'discount_value'),
    discountAmount: readAmount(row, 'discount_amount'),
    taxPercentage: readAmount(row, 'tax_percentage'),
    taxName: readString(row, 'tax_name_snapshot'),
    taxAmount: readAmount(row, 'tax_amount'),
    lineSubtotal: readAmount(row, 'line_subtotal'),
    lineTotal: readAmount(row, 'line_total'),
    productId: readString(row, 'product_id'),
    taxRateId: readString(row, 'tax_rate_id'),
  };
}

/**
 * Maps the full invoice shown on its own page.
 *
 * @param row Row read from public.invoices.
 * @param lines Lines held against the invoice.
 * @returns The invoice detail record.
 */
export function toInvoiceDetail(row: DatabaseRow, lines: readonly DatabaseRow[]): InvoiceDetail {
  return {
    ...toInvoiceSummary(row),
    clientEmail: readJoined(row, 'clients', 'email'),
    billTo: toInvoiceParty(row),
    subtotalAmount: readAmount(row, 'subtotal_amount'),
    lineDiscountAmount: readAmount(row, 'line_discount_amount'),
    documentDiscountAmount: readAmount(row, 'document_discount_amount'),
    taxAmount: readAmount(row, 'tax_amount'),
    shippingAmount: readAmount(row, 'shipping_amount'),
    creditedAmount: readAmount(row, 'credited_amount'),
    paymentTermsDays: readNumber(row, 'payment_terms_days'),
    purchaseOrderReference: readString(row, 'purchase_order_reference'),
    notes: readString(row, 'notes'),
    termsAndConditions: readString(row, 'terms_and_conditions'),
    footerNote: readString(row, 'footer_note'),
    internalMemo: readString(row, 'internal_memo'),
    issuedAt: readString(row, 'issued_at'),
    sentAt: readString(row, 'sent_at'),
    firstViewedAt: readString(row, 'first_viewed_at'),
    lastViewedAt: readString(row, 'last_viewed_at'),
    viewCount: readNumber(row, 'view_count') ?? 0,
    paidAt: readString(row, 'paid_at'),
    cancelledAt: readString(row, 'cancelled_at'),
    cancellationReason: readString(row, 'cancellation_reason'),
    createdAt: readString(row, 'created_at'),
    lines: lines.map((line) => toInvoiceLine(line)),
  };
}
