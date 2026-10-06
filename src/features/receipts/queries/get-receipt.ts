// src/features/receipts/queries/get-receipt.ts
// Reading one receipt in full, including the lines the reader found and the
// fields it was least sure about.

import type { ReceiptDetailRecord, ReceiptLine } from '@/features/receipts/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type Json, type JsonObject } from '@/types/json';

/**
 * Reads one text value out of the answer.
 *
 * @param source The receipt as the database returned it.
 * @param key Field being read.
 * @returns The value, or null.
 */
function text(source: JsonObject, key: string): string | null {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : null;
}

/**
 * Maps the lines the reader found.
 *
 * @param value The lines as the database returned them.
 * @returns The lines in the order they were printed.
 */
function toLines(value: Json | undefined): readonly ReceiptLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonObject).map((entry, index) => ({
    lineOrder: typeof entry.line_order === 'number' ? entry.line_order : index + 1,
    description: typeof entry.description === 'string' ? entry.description : 'Item',
    quantity: text(entry, 'quantity') ?? '1',
    unitPrice: text(entry, 'unit_price'),
    lineTotal: text(entry, 'line_total') ?? '0',
    taxAmount: text(entry, 'tax_amount') ?? '0',
    confidence: text(entry, 'confidence'),
  }));
}

/**
 * Reads one receipt.
 *
 * @param scanId Receipt being read.
 * @returns The receipt, or null when it is gone or belongs elsewhere.
 */
export async function loadReceipt(scanId: string): Promise<ReceiptDetailRecord | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('receipt_scan_detail', { p_scan_id: scanId });

  if (error || !isJsonObject(data)) {
    if (error) {
      logger.error('One receipt could not be read', error, { scanId });
    }

    return null;
  }

  const low = data.low_confidence_fields;

  return {
    scanId: text(data, 'scan_id') ?? scanId,
    fileName: text(data, 'file_name') ?? '',
    contentType: text(data, 'content_type') ?? 'image/jpeg',
    storageKey: text(data, 'storage_key') ?? '',
    source: text(data, 'source') ?? 'upload',
    status: text(data, 'status') ?? 'pending',
    provider: text(data, 'provider'),
    uploadedAt: text(data, 'uploaded_at') ?? '',
    merchantName: text(data, 'merchant_name'),
    merchantTaxId: text(data, 'merchant_tax_id'),
    receiptDate: text(data, 'receipt_date'),
    receiptNumber: text(data, 'receipt_number'),
    currency: text(data, 'currency'),
    subtotalAmount: text(data, 'subtotal_amount'),
    taxAmount: text(data, 'tax_amount'),
    tipAmount: text(data, 'tip_amount'),
    totalAmount: text(data, 'total_amount'),
    paymentMethodHint: text(data, 'payment_method_hint'),
    cardLast4: text(data, 'card_last4'),
    overallConfidence: text(data, 'overall_confidence'),
    lowConfidenceFields: Array.isArray(low)
      ? low.filter((entry): entry is string => typeof entry === 'string')
      : [],
    lineCount: Array.isArray(data.lines) ? data.lines.length : 0,
    errorMessage: text(data, 'error_message'),
    expenseId: text(data, 'expense_id'),
    rawText: text(data, 'raw_text'),
    lines: toLines(data.lines),
  };
}
