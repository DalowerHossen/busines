// src/features/estimates/mappers.ts
// Turning estimate rows into the shapes the interface renders.

import type {
  EstimateDetail,
  EstimateLine,
  EstimateParty,
  EstimateSummary,
} from '@/features/estimates/types';
import { readAmount, readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import { ESTIMATE_STATUSES } from '@/types/enums';

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
 * @param source The bill_to object stored on the estimate.
 * @param field Field to read.
 * @returns The value, or null when it was not captured.
 */
function readParty(source: Record<string, unknown>, field: string): string | null {
  const value = source[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Maps the frozen billing party of an estimate.
 *
 * @param row Row read from public.estimates.
 * @returns The party the quotation is addressed to.
 */
export function toEstimateParty(row: DatabaseRow): EstimateParty {
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
 * Maps one row of the estimate list.
 *
 * @param row Row read from public.estimates.
 * @returns The estimate as the list renders it.
 */
export function toEstimateSummary(row: DatabaseRow): EstimateSummary {
  const snapshot = readString(row, 'client_name_snapshot');

  return {
    id: readString(row, 'id') ?? '',
    estimateNumber: readString(row, 'estimate_number'),
    status: readEnum(row, 'status', ESTIMATE_STATUSES, 'draft'),
    title: readString(row, 'title'),
    clientId: readString(row, 'client_id') ?? '',
    clientName: snapshot ?? readJoined(row, 'clients', 'display_name') ?? 'Client removed',
    currency: readString(row, 'currency') ?? 'USD',
    issueDate: readString(row, 'issue_date') ?? '',
    validUntil: readString(row, 'valid_until'),
    totalAmount: readAmount(row, 'total_amount'),
    convertedInvoiceId: readString(row, 'converted_invoice_id'),
    isDeleted: readString(row, 'deleted_at') !== null,
  };
}

/**
 * Maps one line of an estimate.
 *
 * @param row Row read from public.estimate_items.
 * @returns The line as the document renders it.
 */
export function toEstimateLine(row: DatabaseRow): EstimateLine {
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
    isOptional: readBoolean(row, 'is_optional'),
    isSelected: readBoolean(row, 'is_selected'),
  };
}

/**
 * Maps the full estimate shown on its own page.
 *
 * @param row Row read from public.estimates.
 * @param lines Lines held against the estimate.
 * @returns The estimate detail record.
 */
export function toEstimateDetail(row: DatabaseRow, lines: readonly DatabaseRow[]): EstimateDetail {
  return {
    ...toEstimateSummary(row),
    clientEmail: readJoined(row, 'clients', 'email'),
    billTo: toEstimateParty(row),
    subtotalAmount: readAmount(row, 'subtotal_amount'),
    discountAmount: readAmount(row, 'discount_amount'),
    taxAmount: readAmount(row, 'tax_amount'),
    shippingAmount: readAmount(row, 'shipping_amount'),
    notes: readString(row, 'notes'),
    termsAndConditions: readString(row, 'terms_and_conditions'),
    footerNote: readString(row, 'footer_note'),
    sentAt: readString(row, 'sent_at'),
    firstViewedAt: readString(row, 'first_viewed_at'),
    lastViewedAt: readString(row, 'last_viewed_at'),
    viewCount: readNumber(row, 'view_count') ?? 0,
    approvedAt: readString(row, 'approved_at'),
    approvedByName: readString(row, 'approved_by_name'),
    declinedAt: readString(row, 'declined_at'),
    declineReason: readString(row, 'decline_reason'),
    convertedAt: readString(row, 'converted_at'),
    createdAt: readString(row, 'created_at'),
    lines: lines.map((line) => toEstimateLine(line)),
  };
}
