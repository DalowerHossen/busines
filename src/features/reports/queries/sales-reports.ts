// src/features/reports/queries/sales-reports.ts
// The reports that look at what was billed: the month by month summary and
// the register of every invoice in the period.

import { moneyCell, numberCell, reportRow, textCell, dateCell } from '@/features/reports/cells';
import type { ReportPeriod, ReportResult, ReportRow } from '@/features/reports/types';
import { logger } from '@/lib/logger';
import { addMoney, subtractMoney, toStoredAmount } from '@/lib/money';
import { asRows, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/dates';

/** Statuses that never count as billed revenue. */
const EXCLUDED_STATUSES = ['draft', 'cancelled'];

/**
 * Describes the period under the title of a report.
 *
 * @param period Period the report covers.
 * @returns The sentence shown to a person.
 */
export function describePeriod(period: ReportPeriod): string {
  return `${formatDate(period.fromDate)} to ${formatDate(period.toDate)}`;
}

interface MonthTotals {
  invoiced: string;
  collected: string;
  count: number;
}

/**
 * Builds the month by month revenue summary.
 *
 * @param companyId Company the figures belong to.
 * @param currency Currency the totals are shown in.
 * @param period Period the report covers.
 * @returns The finished report.
 */
export async function buildRevenueSummary(
  companyId: string,
  currency: string,
  period: ReportPeriod
): Promise<ReportResult> {
  const supabase = createServerSupabaseClient();
  const base: ReportResult = {
    reportKey: 'revenue-summary',
    title: 'Revenue summary',
    description: 'Invoiced, collected and still outstanding, month by month.',
    columns: [
      { key: 'month', label: 'Month', kind: 'text' },
      { key: 'count', label: 'Invoices', kind: 'number' },
      { key: 'invoiced', label: 'Invoiced', kind: 'money' },
      { key: 'collected', label: 'Collected', kind: 'money' },
      { key: 'outstanding', label: 'Outstanding', kind: 'money' },
    ],
    rows: [],
    totalRow: reportRow('total', [
      textCell('TOTAL'),
      numberCell(0),
      moneyCell('0.00', currency),
      moneyCell('0.00', currency),
      moneyCell('0.00', currency),
    ]),
    periodLabel: describePeriod(period),
    isDegraded: false,
  };

  const { data, error } = await supabase
    .from('invoices')
    .select('id, issue_date, status, total_amount, paid_amount')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
    .gte('issue_date', period.fromDate)
    .lte('issue_date', period.toDate)
    .order('issue_date', { ascending: true });

  if (error) {
    logger.error('Could not build the revenue summary', error, { companyId });
    return { ...base, isDegraded: true };
  }

  const months = new Map<string, MonthTotals>();

  for (const row of asRows(data)) {
    const issueDate = readString(row, 'issue_date');

    if (issueDate === null) {
      continue;
    }

    const month = issueDate.slice(0, 7);
    const current = months.get(month) ?? { invoiced: '0', collected: '0', count: 0 };

    months.set(month, {
      invoiced: toStoredAmount(addMoney(current.invoiced, readAmount(row, 'total_amount'))),
      collected: toStoredAmount(addMoney(current.collected, readAmount(row, 'paid_amount'))),
      count: current.count + 1,
    });
  }

  let totalInvoiced = '0';
  let totalCollected = '0';
  let totalCount = 0;

  const rows: ReportRow[] = [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, totals]) => {
      totalInvoiced = toStoredAmount(addMoney(totalInvoiced, totals.invoiced));
      totalCollected = toStoredAmount(addMoney(totalCollected, totals.collected));
      totalCount += totals.count;

      return reportRow(month, [
        textCell(month),
        numberCell(totals.count),
        moneyCell(totals.invoiced, currency),
        moneyCell(totals.collected, currency),
        moneyCell(toStoredAmount(subtractMoney(totals.invoiced, totals.collected)), currency),
      ]);
    });

  return {
    ...base,
    rows,
    totalRow: reportRow('total', [
      textCell('TOTAL'),
      numberCell(totalCount),
      moneyCell(totalInvoiced, currency),
      moneyCell(totalCollected, currency),
      moneyCell(toStoredAmount(subtractMoney(totalInvoiced, totalCollected)), currency),
    ]),
  };
}

/**
 * Builds the register of every invoice issued in the period.
 *
 * @param companyId Company the figures belong to.
 * @param currency Currency the totals are shown in.
 * @param period Period the report covers.
 * @returns The finished report.
 */
export async function buildInvoiceRegister(
  companyId: string,
  currency: string,
  period: ReportPeriod
): Promise<ReportResult> {
  const supabase = createServerSupabaseClient();
  const base: ReportResult = {
    reportKey: 'invoice-register',
    title: 'Invoice register',
    description: 'Every invoice issued in the period, with its balance.',
    columns: [
      { key: 'number', label: 'Invoice', kind: 'text' },
      { key: 'client', label: 'Client', kind: 'text' },
      { key: 'issue', label: 'Issued', kind: 'date' },
      { key: 'due', label: 'Due', kind: 'date' },
      { key: 'status', label: 'Status', kind: 'text' },
      { key: 'total', label: 'Total', kind: 'money' },
      { key: 'paid', label: 'Paid', kind: 'money' },
      { key: 'balance', label: 'Balance', kind: 'money' },
    ],
    rows: [],
    totalRow: reportRow('total', [
      textCell('TOTAL'),
      textCell(''),
      textCell(''),
      textCell(''),
      textCell(''),
      moneyCell('0.00', currency),
      moneyCell('0.00', currency),
      moneyCell('0.00', currency),
    ]),
    periodLabel: describePeriod(period),
    isDegraded: false,
  };

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, client_name_snapshot, issue_date, due_date, status, total_amount, paid_amount, balance_due'
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
    .gte('issue_date', period.fromDate)
    .lte('issue_date', period.toDate)
    .order('issue_date', { ascending: true });

  if (error) {
    logger.error('Could not build the invoice register', error, { companyId });
    return { ...base, isDegraded: true };
  }

  let totalAmount = '0';
  let totalPaid = '0';
  let totalBalance = '0';

  const rows = asRows(data).map((row, index) => {
    const amount = readAmount(row, 'total_amount');
    const paid = readAmount(row, 'paid_amount');
    const balance = readAmount(row, 'balance_due');

    totalAmount = toStoredAmount(addMoney(totalAmount, amount));
    totalPaid = toStoredAmount(addMoney(totalPaid, paid));
    totalBalance = toStoredAmount(addMoney(totalBalance, balance));

    return reportRow(readString(row, 'id') ?? String(index), [
      textCell(readString(row, 'invoice_number')),
      textCell(readString(row, 'client_name_snapshot')),
      dateCell(readString(row, 'issue_date')),
      dateCell(readString(row, 'due_date')),
      textCell(readString(row, 'status')),
      moneyCell(amount, currency),
      moneyCell(paid, currency),
      moneyCell(balance, currency),
    ]);
  });

  return {
    ...base,
    rows,
    totalRow: reportRow('total', [
      textCell('TOTAL'),
      textCell(''),
      textCell(''),
      textCell(''),
      textCell(''),
      moneyCell(totalAmount, currency),
      moneyCell(totalPaid, currency),
      moneyCell(totalBalance, currency),
    ]),
  };
}
