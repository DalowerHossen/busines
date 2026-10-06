// src/features/reports/export.ts
// Turning a finished report into the two files people ask for, with the same
// figures and the same total line in both.

import type { ReportResult } from '@/features/reports/types';
import { BRAND } from '@/config/brand';
import { buildCsv } from '@/lib/export/csv';
import { buildTablePdf } from '@/lib/export/pdf';
import { formatDateTime } from '@/lib/dates';

/**
 * Builds the file name a download is offered under.
 *
 * @param report Report being downloaded.
 * @param extension File extension, without the dot.
 * @returns The file name.
 */
export function reportFileName(report: ReportResult, extension: string): string {
  const period = report.periodLabel.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();

  return `${report.reportKey}-${period}.${extension}`;
}

/**
 * Renders a report as comma separated text.
 *
 * @param report Report being downloaded.
 * @param companyName Name printed above the headings.
 * @returns The file content.
 */
export function reportToCsv(report: ReportResult, companyName: string): string {
  return buildCsv({
    preamble: [
      companyName,
      report.title,
      report.periodLabel,
      `Prepared ${formatDateTime(new Date().toISOString())} by ${BRAND.name}`,
    ],
    headers: report.columns.map((column) => column.label),
    rows: report.rows.map((row) => row.cells.map((cell) => cell.raw)),
    totalRow: report.totalRow.cells.map((cell) => cell.raw ?? cell.display),
  });
}

/**
 * Renders a report as a PDF file.
 *
 * @param report Report being downloaded.
 * @param companyName Name printed under the title.
 * @returns The file content.
 */
export function reportToPdf(report: ReportResult, companyName: string): Uint8Array {
  const numericColumns = report.columns
    .map((column, index) => (column.kind === 'money' || column.kind === 'number' ? index : -1))
    .filter((index) => index >= 0);

  return buildTablePdf({
    title: report.title,
    subtitles: [companyName, report.periodLabel, report.description],
    headers: report.columns.map((column) => column.label),
    rows: report.rows.map((row) => row.cells.map((cell) => cell.display)),
    totalRow: report.totalRow.cells.map((cell) => cell.display),
    numericColumns,
    footerNote: `Prepared with ${BRAND.name}`,
  });
}
