// src/lib/pdf/types.ts
// Provider-neutral input and output types for server-rendered invoices and
// estimates. The renderer consumes frozen document snapshots, not live
// company/client records, so a later profile edit cannot change an archived
// document.
import type { CurrencyCode, Money } from '@/types/core';

export type PdfPageSize = 'A4' | 'LETTER';
export type PdfDocumentType = 'invoice' | 'estimate' | 'credit_note' | 'debit_note';
export type PdfDocumentStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'approved'
  | 'declined'
  | 'expired';

export type PdfImageSource = string | Buffer;

export interface PdfAddress {
  readonly line1: string;
  readonly line2?: string | null;
  readonly city: string;
  readonly state?: string | null;
  readonly postalCode?: string | null;
  readonly country?: string | null;
}

export interface PdfParty {
  readonly name: string;
  readonly address?: PdfAddress | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly taxId?: string | null;
  readonly website?: string | null;
  readonly logo?: PdfImageSource | null;
}

export interface PdfLineItem {
  readonly description: string;
  readonly itemCode?: string | null;
  readonly unitOfMeasure?: string | null;
  readonly quantity: string;
  readonly unitPrice: Money;
  readonly taxRatePercent?: string | null;
  readonly discountPercent?: string | null;
  readonly lineTotal: Money;
}

export interface PdfTaxBreakdownItem {
  readonly label: string;
  readonly ratePercent: string;
  readonly taxableAmount: Money;
  readonly taxAmount: Money;
}

export interface PdfRemitTo {
  readonly label?: string;
  readonly lines: readonly string[];
}

export interface InvoicePdfInput {
  readonly documentType: PdfDocumentType;
  readonly documentNumber: string;
  readonly status?: PdfDocumentStatus | null;
  readonly title?: string | null;
  readonly company: PdfParty;
  readonly client: PdfParty;
  readonly issueDate: string;
  readonly dueDate?: string | null;
  readonly currency: CurrencyCode;
  readonly lineItems: readonly PdfLineItem[];
  readonly subtotal: Money;
  readonly discountTotal: Money;
  readonly taxTotal: Money;
  readonly total: Money;
  readonly amountPaid?: Money | null;
  readonly amountDue?: Money | null;
  readonly taxBreakdown?: readonly PdfTaxBreakdownItem[];
  readonly notes?: string | null;
  readonly termsAndConditions?: string | null;
  readonly remitTo?: PdfRemitTo | null;
  readonly footerText?: string | null;
  readonly pageSize?: PdfPageSize;
  readonly locale?: string;
}

export interface PdfRenderOptions {
  readonly pageSize?: PdfPageSize;
  readonly locale?: string;
  readonly archiveFileName?: string;
}

export interface PdfRenderResult {
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly contentType: 'application/pdf';
  readonly fileName: string;
  readonly pageSize: PdfPageSize;
}
