import { createHash } from 'node:crypto';

import {
  buildInformationReturnRows,
  collectRowIssues,
  validateFilerConfiguration,
} from './us-information-returns';
import type {
  FilerConfiguration,
  InformationReturnRow,
  InformationReturnRuleSet,
  TaxDocumentPackage,
  TaxIdentityProfile,
  TaxPaymentRecord,
} from './types';

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function rowsToCsv(taxYear: number, rows: readonly InformationReturnRow[]): string {
  const headers = [
    'tax_year',
    'form_type',
    'recipient_name',
    'recipient_tin_last_four',
    'recipient_address_line1',
    'recipient_address_city',
    'recipient_address_state',
    'recipient_address_postal_code',
    'recipient_address_country',
    'account_reference',
    'gross_amount',
    'transaction_count',
    'federal_withholding_amount',
    'validation_error_count',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        taxYear,
        row.formType,
        row.recipientName,
        row.recipientTinLastFour,
        row.recipientAddress.line1,
        row.recipientAddress.city,
        row.recipientAddress.stateOrProvince,
        row.recipientAddress.postalCode,
        row.recipientAddress.countryCode,
        row.accountReference,
        row.grossAmount.toFixed(2),
        row.transactionCount,
        row.federalWithholdingAmount.toFixed(2),
        row.issues.filter((issue) => issue.severity === 'error').length,
      ]
        .map((value) => csvCell(value))
        .join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildReviewReport(
  rules: InformationReturnRuleSet,
  rows: readonly InformationReturnRow[],
  issues: TaxDocumentPackage['issues'],
  filer: FilerConfiguration | null
): string {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const filingNote =
    'This package is prepared for review and export. It has not been transmitted to or filed with the IRS.';
  const rowMarkup = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.formType)}</td><td>${escapeHtml(
          row.recipientName
        )}</td><td>${row.grossAmount.toFixed(2)}</td><td>${row.issues.length}</td></tr>`
    )
    .join('');
  const issueMarkup = issues
    .map(
      (issue) =>
        `<li class="${issue.severity}">${escapeHtml(issue.message)}${
          issue.payeeId ? ` (payee ${escapeHtml(issue.payeeId)})` : ''
        }</li>`
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>U.S. tax document review package</title>
<style>body{font-family:Arial,sans-serif;color:#172033;margin:40px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}.error{color:#b42318}.warning{color:#9a6700}.notice{padding:12px;background:#eff6ff;border:1px solid #93c5fd}small{color:#475569}</style>
</head><body><h1>U.S. tax document review package</h1>
<p><strong>Tax year:</strong> ${rules.taxYear}<br><strong>Policy version:</strong> ${escapeHtml(
    rules.policyVersion
  )}<br><strong>Filer:</strong> ${escapeHtml(filer?.legalName ?? 'Not configured')}</p>
<p class="notice">${filingNote}</p>
<h2>Validation summary</h2><p>${errorCount} blocking error(s), ${
    issues.filter((issue) => issue.severity === 'warning').length
  } warning(s), ${rows.length} return row(s).</p>
<ul>${issueMarkup || '<li>No validation issues.</li>'}</ul>
<h2>Recipient records</h2><table><thead><tr><th>Form</th><th>Recipient</th><th>Gross amount</th><th>Issues</th></tr></thead><tbody>${rowMarkup}</tbody></table>
<h2>Source and filing boundary</h2><p><small>${rules.sourceUrls
    .map((url) => escapeHtml(url))
    .join('<br>')}</small></p>
<p><small>IRIS configured: ${rules.irsElectronicFilingConfigured ? 'yes' : 'no'}; status: not filed.</small></p>
</body></html>`;
}

export function buildUsTaxDocumentPackage(input: {
  readonly filer: FilerConfiguration | null;
  readonly rules: InformationReturnRuleSet;
  readonly payments: readonly TaxPaymentRecord[];
  readonly profiles: ReadonlyMap<string, TaxIdentityProfile>;
  readonly generatedAt?: Date;
}): TaxDocumentPackage {
  const generatedAt = input.generatedAt ?? new Date();
  const filerIssues = validateFilerConfiguration(input.filer);
  const rows = buildInformationReturnRows(input.payments, input.profiles, input.rules, generatedAt);
  const rowIssues = collectRowIssues(rows);
  const issues = [...filerIssues, ...rowIssues];
  const csv = rowsToCsv(input.rules.taxYear, rows);
  const reviewReportHtml = buildReviewReport(input.rules, rows, issues, input.filer);
  const contentSha256 = createHash('sha256').update(`${csv}\n${reviewReportHtml}`).digest('hex');

  return {
    taxYear: input.rules.taxYear,
    policyVersion: input.rules.policyVersion,
    status: issues.some((issue) => issue.severity === 'error') ? 'blocked' : 'ready',
    generatedAt: generatedAt.toISOString(),
    rows,
    issues,
    csv,
    reviewReportHtml,
    manifest: {
      artifactType: 'us-information-return-review-package',
      filingStatus: 'not_filed',
      filingSystem: input.rules.irsElectronicFilingSystem,
      filingConfigurationPresent: input.rules.irsElectronicFilingConfigured,
      sourceUrls: input.rules.sourceUrls,
      rowCount: rows.length,
      contentSha256,
    },
  };
}
