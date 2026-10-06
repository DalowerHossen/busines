// src/features/receipts/types.ts
// The shapes the receipt pages work with: what was photographed, what the
// reader made of it, and what it is about to become.

export interface ReceiptLine {
  lineOrder: number;
  description: string;
  quantity: string;
  unitPrice: string | null;
  lineTotal: string;
  taxAmount: string;
  confidence: string | null;
}

export interface ReceiptSummaryRecord {
  scanId: string;
  fileName: string;
  contentType: string;
  storageKey: string;
  source: string;
  status: string;
  provider: string | null;
  uploadedAt: string;
  merchantName: string | null;
  receiptDate: string | null;
  currency: string | null;
  subtotalAmount: string | null;
  taxAmount: string | null;
  totalAmount: string | null;
  overallConfidence: string | null;
  lowConfidenceFields: readonly string[];
  lineCount: number;
  errorMessage: string | null;
  expenseId: string | null;
}

export interface ReceiptDetailRecord extends ReceiptSummaryRecord {
  merchantTaxId: string | null;
  receiptNumber: string | null;
  tipAmount: string | null;
  paymentMethodHint: string | null;
  cardLast4: string | null;
  rawText: string | null;
  lines: readonly ReceiptLine[];
}

export interface ReceiptCounts {
  waiting: number;
  needsReview: number;
  accepted: number;
  duplicate: number;
  failed: number;
  averageConfidence: string;
}
