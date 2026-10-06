// src/features/portal/export.ts
// Turning a client document into the PDF the client downloads. It carries the
// same figures as the page, with the total line at the bottom.

import type { PortalDocument } from '@/features/portal/types';
import { formatDate } from '@/lib/dates';
import { buildTablePdf } from '@/lib/export/pdf';
import { formatMoney, formatNumber } from '@/lib/format';

/**
 * Builds the lines printed under the title.
 *
 * @param document Document being printed.
 * @returns The subtitle lines.
 */
function subtitlesFor(document: PortalDocument): readonly string[] {
  const lines = [
    document.brand.tradeName ?? document.brand.legalName,
    `Issued ${formatDate(document.issueDate)}`,
  ];

  if (document.dueDate) {
    lines.push(`Due ${formatDate(document.dueDate)}`);
  }

  if (document.validUntil) {
    lines.push(`Valid until ${formatDate(document.validUntil)}`);
  }

  if (document.billTo.name) {
    lines.push(`Billed to ${document.billTo.name}`);
  }

  return lines;
}

/**
 * Writes a client document as a PDF.
 *
 * @param document Document being printed.
 * @returns The bytes of the file.
 */
export function portalDocumentToPdf(document: PortalDocument): Uint8Array {
  const currency = document.currency;

  return buildTablePdf({
    title: `${document.kind === 'invoice' ? 'Invoice' : 'Estimate'} ${document.number}`,
    subtitles: subtitlesFor(document),
    headers: ['Description', 'Quantity', 'Unit price', 'Tax', 'Amount'],
    rows: document.lines.map((line) => [
      line.description,
      formatNumber(Number.parseFloat(line.quantity), 2),
      formatMoney(line.unitPrice, currency),
      formatMoney(line.taxAmount, currency),
      formatMoney(line.lineTotal, currency),
    ]),
    totalRow: [
      'TOTAL',
      '',
      formatMoney(document.subtotalAmount, currency),
      formatMoney(document.taxAmount, currency),
      formatMoney(document.totalAmount, currency),
    ],
    numericColumns: [1, 2, 3, 4],
    footerNote:
      document.footerNote ?? `Please quote ${document.number} with your payment. Thank you.`,
  });
}

/**
 * Names the downloaded file.
 *
 * @param document Document being printed.
 * @returns A file name a client will recognise.
 */
export function portalFileName(document: PortalDocument): string {
  const safeNumber = document.number.replace(/[^A-Za-z0-9-]/g, '-');
  return `${document.kind}-${safeNumber}.pdf`;
}
