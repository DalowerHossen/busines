// src/lib/pdf/renderer.ts
// Server-only PDF generation and immutable snapshot preparation. The exact
// bytes returned here are the bytes whose SHA-256 value belongs in the
// invoice/estimate rendered_pdf_hash columns.
import 'server-only';

import crypto from 'node:crypto';

import { renderToBuffer } from '@react-pdf/renderer';

import type { StorageAdapter, StorageFileCategory, StorageFileMetadata } from '@/types/storage';

import { PdfRenderError } from './errors';
import { InvoicePdfDocument } from './document';
import { documentLabel } from './format';
import type { InvoicePdfInput, PdfRenderOptions, PdfRenderResult } from './types';

function safePdfFileName(input: InvoicePdfInput, requestedName?: string): string {
  const defaultName = `${documentLabel(input.documentType)}-${input.documentNumber}.pdf`;
  const candidate = (requestedName ?? defaultName)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .replace(/[\\/]/g, '-')
    .trim()
    .slice(0, 160);
  const withoutExtension = candidate.replace(/\.pdf$/iu, '').trim();
  if (!withoutExtension || withoutExtension === '.' || withoutExtension === '..') {
    throw new PdfRenderError('invalid_document');
  }
  return `${withoutExtension}.pdf`;
}

function validatePdfInput(input: InvoicePdfInput): void {
  if (!input.documentNumber.trim() || !input.company.name.trim() || !input.client.name.trim()) {
    throw new PdfRenderError('invalid_document');
  }
  if (input.lineItems.some((item) => !item.description.trim())) {
    throw new PdfRenderError('invalid_document');
  }
  if (input.pageSize && input.pageSize !== 'A4' && input.pageSize !== 'LETTER') {
    throw new PdfRenderError('invalid_document');
  }
}

export async function renderInvoicePdf(
  input: InvoicePdfInput,
  options: PdfRenderOptions = {}
): Promise<PdfRenderResult> {
  validatePdfInput(input);
  const pageSize = options.pageSize ?? input.pageSize ?? 'A4';
  const fileName = safePdfFileName(input, options.archiveFileName);

  try {
    const bytes = await renderToBuffer(<InvoicePdfDocument input={{ ...input, pageSize }} />);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    return {
      bytes,
      sha256,
      contentType: 'application/pdf',
      fileName,
      pageSize,
    };
  } catch (error) {
    if (error instanceof PdfRenderError) throw error;
    throw new PdfRenderError('render_failed');
  }
}

export interface PdfSnapshotResult {
  readonly metadata: StorageFileMetadata;
  readonly sha256: string;
}

function snapshotCategory(documentType: InvoicePdfInput['documentType']): StorageFileCategory {
  return documentType === 'estimate' ? 'estimate_pdf' : 'invoice_pdf';
}

export async function archivePdfSnapshot(
  storage: StorageAdapter,
  input: InvoicePdfInput & { readonly companyId: string },
  options: PdfRenderOptions = {}
): Promise<PdfSnapshotResult> {
  const rendered = await renderInvoicePdf(input, options);
  const metadata = await storage.uploadFile({
    companyId: input.companyId,
    category: snapshotCategory(input.documentType),
    fileName: rendered.fileName,
    mimeType: rendered.contentType,
    sizeInBytes: rendered.bytes.byteLength,
    content: rendered.bytes,
    visibility: 'private',
  });

  return { metadata, sha256: rendered.sha256 };
}
