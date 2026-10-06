// src/features/reports/queries/relationship-reports.ts
// The reports that group figures by who they belong to: revenue by client and
// spending by category.

import { moneyCell, numberCell, reportRow, textCell } from '@/features/reports/cells';
import { describePeriod } from '@/features/reports/queries/sales-reports';
import type { ReportPeriod, ReportResult, ReportRow } from '@/features/reports/types';
import { logger } from '@/lib/logger';
import { addMoney, compareMoney, subtractMoney, toStoredAmount } from '@/lib/money';
import { asRows, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface GroupTotals {
  label: string;
  count: number;
  gross: string;
  settled: string;
}

/**
 * Sorts the groups by value, largest first.
 *
 * @param left First group.
 * @param right Second group.
 * @returns The ordering of the two groups.
 */
function byValue(left: GroupTotals, right: GroupTotals): number {
  return compareMoney(right.gross, left.gross);
}

/**
 * Builds revenue by client for the period.
 *
 * @param companyId Company the figures belong to.
 * @param currency Currency the totals are shown in.
 * @param period Period the report covers.
 * @returns The finished report.
 */
export async function buildClientRevenue(
  companyId: string,
  currency: string,
  period: ReportPeriod
): Promise<ReportResult> {
  const supabase = createServerSupabaseClient();
  const base: ReportResult = {
    reportKey: 'client-revenue',
    title: 'Revenue by client',
    description: 'What each client was billed and what each has paid.',
    columns: [
      { key: 'client', label: 'Client', kind: 'text' },
      { key: 'count', label: 'Invoices', kind: 'number' },
      { key: 'invoiced', label: 'Invoiced', kind: 'money' },
      { key: 'paid', label: 'Paid', kind: 'money' },
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
    .select('id, client_id, client_name_snapshot, total_amount, paid_amount')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .not('status', 'in', '(draft,cancelled)')
    .gte('issue_date', period.fromDate)
    .lte('issue_date', period.toDate);

  if (error) {
    logger.error('Could not build the client revenue report', error, { companyId });
    return { ...base, isDegraded: true };
  }

  const groups = new Map<string, GroupTotals>();

  for (const row of asRows(data)) {
    const key = readString(row, 'client_id') ?? 'unknown';
    const current = groups.get(key) ?? {
      label: readString(row, 'client_name_snapshot') ?? 'Client removed',
      count: 0,
      gross: '0',
      settled: '0',
    };

    groups.set(key, {
      label: current.label,
      count: current.count + 1,
      gross: toStoredAmount(addMoney(current.gross, readAmount(row, 'total_amount'))),
      settled: toStoredAmount(addMoney(current.settled, readAmount(row, 'paid_amount'))),
    });
  }

  let totalCount = 0;
  let totalGross = '0';
  let totalSettled = '0';

  const rows: ReportRow[] = [...groups.entries()]
    .sort(([, left], [, right]) => byValue(left, right))
    .map(([key, group]) => {
      totalCount += group.count;
      totalGross = toStoredAmount(addMoney(totalGross, group.gross));
      totalSettled = toStoredAmount(addMoney(totalSettled, group.settled));

      return reportRow(key, [
        textCell(group.label),
        numberCell(group.count),
        moneyCell(group.gross, currency),
        moneyCell(group.settled, currency),
        moneyCell(toStoredAmount(subtractMoney(group.gross, group.settled)), currency),
      ]);
    });

  return {
    ...base,
    rows,
    totalRow: reportRow('total', [
      textCell('TOTAL'),
      numberCell(totalCount),
      moneyCell(totalGross, currency),
      moneyCell(totalSettled, currency),
      moneyCell(toStoredAmount(subtractMoney(totalGross, totalSettled)), currency),
    ]),
  };
}

/**
 * Builds spending by category for the period.
 *
 * @param companyId Company the figures belong to.
 * @param currency Currency the totals are shown in.
 * @param period Period the report covers.
 * @returns The finished report.
 */
export async function buildExpenseSummary(
  companyId: string,
  currency: string,
  period: ReportPeriod
): Promise<ReportResult> {
  const supabase = createServerSupabaseClient();
  const base: ReportResult = {
    reportKey: 'expense-summary',
    title: 'Spending by category',
    description: 'What the business spent, grouped by expense category.',
    columns: [
      { key: 'category', label: 'Category', kind: 'text' },
      { key: 'count', label: 'Claims', kind: 'number' },
      { key: 'net', label: 'Before tax', kind: 'money' },
      { key: 'tax', label: 'Tax', kind: 'money' },
      { key: 'total', label: 'Total', kind: 'money' },
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
    .from('expenses')
    .select('id, category_id, subtotal_amount, tax_amount, total_amount, expense_categories(name)')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .not('status', 'eq', 'rejected')
    .gte('expense_date', period.fromDate)
    .lte('expense_date', period.toDate);

  if (error) {
    logger.error('Could not build the spending report', error, { companyId });
    return { ...base, isDegraded: true };
  }

  const groups = new Map<string, { label: string; count: number; net: string; tax: string }>();

  for (const row of asRows(data)) {
    const key = readString(row, 'category_id') ?? 'uncategorised';
    const joined = row['expense_categories'];
    const name =
      joined !== null && typeof joined === 'object' && !Array.isArray(joined)
        ? (joined as Record<string, unknown>)['name']
        : null;

    const current = groups.get(key) ?? {
      label: typeof name === 'string' ? name : 'Not categorised',
      count: 0,
      net: '0',
      tax: '0',
    };

    groups.set(key, {
      label: current.label,
      count: current.count + 1,
      net: toStoredAmount(addMoney(current.net, readAmount(row, 'subtotal_amount'))),
      tax: toStoredAmount(addMoney(current.tax, readAmount(row, 'tax_amount'))),
    });
  }

  let totalCount = 0;
  let totalNet = '0';
  let totalTax = '0';

  const rows: ReportRow[] = [...groups.entries()]
    .sort(([, left], [, right]) => compareMoney(right.net, left.net))
    .map(([key, group]) => {
      totalCount += group.count;
      totalNet = toStoredAmount(addMoney(totalNet, group.net));
      totalTax = toStoredAmount(addMoney(totalTax, group.tax));

      return reportRow(key, [
        textCell(group.label),
        numberCell(group.count),
        moneyCell(group.net, currency),
        moneyCell(group.tax, currency),
        moneyCell(toStoredAmount(addMoney(group.net, group.tax)), currency),
      ]);
    });

  return {
    ...base,
    rows,
    totalRow: reportRow('total', [
      textCell('TOTAL'),
      numberCell(totalCount),
      moneyCell(totalNet, currency),
      moneyCell(totalTax, currency),
      moneyCell(toStoredAmount(addMoney(totalNet, totalTax)), currency),
    ]),
  };
}
