// tests/unit/reports-export.test.ts
// Every report must be downloadable as a spreadsheet and as a document,
// and both must carry the same total line.
//
// This is a promise made to the person who files the accounts. A report
// whose columns add up on screen and not in the file they sent to their
// accountant is worse than no report at all.

import { describe, expect, it } from 'vitest';

import { REPORT_DEFINITIONS, findReport } from '@/features/reports/registry';
import { reportFileName, reportToCsv, reportToPdf } from '@/features/reports/export';
import type { ReportResult } from '@/features/reports/types';

/**
 * Builds a finished report of the shape every builder returns.
 *
 * @returns A report with two rows and a total line.
 */
function sampleReport(): ReportResult {
  return {
    reportKey: 'revenue-summary',
    title: 'Revenue summary',
    description: 'Invoiced, collected and still outstanding, month by month.',
    periodLabel: 'January 2026',
    columns: [
      { key: 'month', label: 'Month', kind: 'text' },
      { key: 'invoiced', label: 'Invoiced', kind: 'money' },
      { key: 'collected', label: 'Collected', kind: 'money' },
    ],
    rows: [
      {
        key: 'january',
        cells: [
          { display: 'January', raw: 'January' },
          { display: '1,000.00', raw: '1000.00' },
          { display: '750.00', raw: '750.00' },
        ],
      },
      {
        key: 'february',
        cells: [
          { display: 'February', raw: 'February' },
          { display: '500.00', raw: '500.00' },
          { display: '500.00', raw: '500.00' },
        ],
      },
    ],
    totalRow: {
      key: 'total',
      cells: [
        { display: 'TOTAL', raw: 'TOTAL' },
        { display: '1,500.00', raw: '1500.00' },
        { display: '1,250.00', raw: '1250.00' },
      ],
    },
    isDegraded: false,
  };
}

describe('the report library', () => {
  it('offers the reports a business actually asks for', () => {
    const keys = REPORT_DEFINITIONS.map((report) => report.key);

    expect(keys).toContain('revenue-summary');
    expect(keys).toContain('receivables-ageing');
    expect(keys).toContain('tax-summary');
  });

  it('describes every report it offers, in words rather than jargon', () => {
    for (const report of REPORT_DEFINITIONS) {
      expect(report.title.length).toBeGreaterThan(3);
      expect(report.description.length).toBeGreaterThan(20);
      expect(report.summary.length).toBeGreaterThan(20);
    }
  });

  it('finds a report by its key, and admits when there is none', () => {
    expect(findReport('revenue-summary')?.title).toBe('Revenue summary');
    expect(findReport('a-report-nobody-wrote')).toBeNull();
  });
});

describe('downloading a report', () => {
  it('puts the total line in the spreadsheet', () => {
    const csv = reportToCsv(sampleReport(), 'Northwind Trading');

    expect(csv).toContain('TOTAL');
    expect(csv).toContain('1500.00');
  });

  it('writes the raw figures rather than the formatted ones into the spreadsheet', () => {
    const csv = reportToCsv(sampleReport(), 'Northwind Trading');

    // A spreadsheet has to be able to add the column up, which it cannot do
    // with a thousands separator in the way.
    expect(csv).toContain('1000.00');
    expect(csv).not.toContain('1,000.00');
  });

  it('names the business and the period above the figures', () => {
    const csv = reportToCsv(sampleReport(), 'Northwind Trading');

    expect(csv).toContain('Northwind Trading');
    expect(csv).toContain('January 2026');
  });

  it('produces a document that is actually a document', () => {
    const file = reportToPdf(sampleReport(), 'Northwind Trading');
    const start = Buffer.from(file.slice(0, 5)).toString('utf8');

    expect(start).toBe('%PDF-');
    expect(file.byteLength).toBeGreaterThan(500);
  });

  it('names the file after the report and its period', () => {
    expect(reportFileName(sampleReport(), 'csv')).toBe('revenue-summary-january-2026.csv');
    expect(reportFileName(sampleReport(), 'pdf')).toBe('revenue-summary-january-2026.pdf');
  });
});
