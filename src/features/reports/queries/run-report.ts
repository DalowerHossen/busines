// src/features/reports/queries/run-report.ts
// One entry point that turns a report key into a finished table, so the page
// and the download route always agree.

import {
  buildPaymentsReceived,
  buildReceivablesAgeing,
  buildTaxSummary,
} from '@/features/reports/queries/money-reports';
import {
  buildClientRevenue,
  buildExpenseSummary,
} from '@/features/reports/queries/relationship-reports';
import {
  buildInvoiceRegister,
  buildRevenueSummary,
} from '@/features/reports/queries/sales-reports';
import type { ReportPeriod, ReportResult } from '@/features/reports/types';

/**
 * Runs one report for a company.
 *
 * @param reportKey Key of the report being run.
 * @param companyId Company the figures belong to.
 * @param currency Currency the totals are shown in.
 * @param period Period the report covers.
 * @returns The finished table, or null when the key is unknown.
 */
export async function runReport(
  reportKey: string,
  companyId: string,
  currency: string,
  period: ReportPeriod
): Promise<ReportResult | null> {
  switch (reportKey) {
    case 'revenue-summary':
      return buildRevenueSummary(companyId, currency, period);
    case 'invoice-register':
      return buildInvoiceRegister(companyId, currency, period);
    case 'receivables-ageing':
      return buildReceivablesAgeing(companyId, currency, period);
    case 'payments-received':
      return buildPaymentsReceived(companyId, currency, period);
    case 'tax-summary':
      return buildTaxSummary(companyId, currency, period);
    case 'client-revenue':
      return buildClientRevenue(companyId, currency, period);
    case 'expense-summary':
      return buildExpenseSummary(companyId, currency, period);
    default:
      return null;
  }
}
