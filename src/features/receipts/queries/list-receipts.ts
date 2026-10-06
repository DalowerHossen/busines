// src/features/receipts/queries/list-receipts.ts
// Reading the receipts that still need somebody, and how well the reader has
// been doing on this account.

import type { ReceiptCounts, ReceiptSummaryRecord } from '@/features/receipts/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readNumber, readString, readStringArray } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReceiptListResult {
  receipts: readonly ReceiptSummaryRecord[];
  counts: ReceiptCounts;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_COUNTS: ReceiptCounts = {
  waiting: 0,
  needsReview: 0,
  accepted: 0,
  duplicate: 0,
  failed: 0,
  averageConfidence: '0',
};

/**
 * Reads the receipt queue of one business.
 *
 * @param companyId Business whose receipts are being read.
 * @returns The receipts, the counts, and whether the read failed.
 */
export async function loadReceipts(companyId: string): Promise<ReceiptListResult> {
  const supabase = createServerSupabaseClient();

  const [queue, summary] = await Promise.all([
    supabase.rpc('receipts_to_review', { p_company_id: companyId, p_limit: 50 }),
    supabase.rpc('receipt_scan_summary', { p_company_id: companyId }),
  ]);

  if (queue.error || summary.error) {
    logger.error('The receipts could not be read', queue.error ?? summary.error, {
      companyId,
    });

    return { receipts: [], counts: EMPTY_COUNTS, isDegraded: true };
  }

  const receipts = asRows(queue.data).map((row) => ({
    scanId: readString(row, 'scan_id') ?? '',
    fileName: readString(row, 'file_name') ?? '',
    contentType: readString(row, 'content_type') ?? 'image/jpeg',
    storageKey: readString(row, 'storage_key') ?? '',
    source: readString(row, 'source') ?? 'upload',
    status: readString(row, 'status') ?? 'pending',
    provider: readString(row, 'provider'),
    uploadedAt: readString(row, 'uploaded_at') ?? '',
    merchantName: readString(row, 'merchant_name'),
    receiptDate: readString(row, 'receipt_date'),
    currency: readString(row, 'currency'),
    subtotalAmount: readString(row, 'subtotal_amount'),
    taxAmount: readString(row, 'tax_amount'),
    totalAmount: readString(row, 'total_amount'),
    overallConfidence: readString(row, 'overall_confidence'),
    lowConfidenceFields: readStringArray(row, 'low_confidence_fields'),
    lineCount: readNumber(row, 'line_count') ?? 0,
    errorMessage: readString(row, 'error_message'),
    expenseId: readString(row, 'expense_id'),
  }));

  const summaryRow = asRow(Array.isArray(summary.data) ? summary.data[0] : summary.data);

  const counts: ReceiptCounts =
    summaryRow === null
      ? EMPTY_COUNTS
      : {
          waiting: readNumber(summaryRow, 'waiting_count') ?? 0,
          needsReview: readNumber(summaryRow, 'review_count') ?? 0,
          accepted: readNumber(summaryRow, 'accepted_count') ?? 0,
          duplicate: readNumber(summaryRow, 'duplicate_count') ?? 0,
          failed: readNumber(summaryRow, 'failed_count') ?? 0,
          averageConfidence: readString(summaryRow, 'average_confidence') ?? '0',
        };

  return { receipts, counts, isDegraded: false };
}
