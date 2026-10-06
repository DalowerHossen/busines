// src/lib/pdf/index.ts
import 'server-only';

export { PdfRenderError } from './errors';
export { createSupabasePdfHashStore } from './hash-store';
export type { PdfHashDocumentType, PdfHashRecordInput, PdfHashStore } from './hash-store';
export { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from './fonts';
export { InvoicePdfDocument } from './document';
export { archivePdfSnapshot, renderInvoicePdf } from './renderer';
export type { PdfSnapshotResult } from './renderer';
export type {
  InvoicePdfInput,
  PdfAddress,
  PdfDocumentStatus,
  PdfDocumentType,
  PdfImageSource,
  PdfLineItem,
  PdfPageSize,
  PdfParty,
  PdfRenderOptions,
  PdfRenderResult,
  PdfRemitTo,
  PdfTaxBreakdownItem,
} from './types';
