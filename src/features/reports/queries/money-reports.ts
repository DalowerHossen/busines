// src/features/reports/queries/money-reports.ts
// The reports that follow the money: what is still owed, what arrived, and
// the tax on both sides of the ledger.

import { PAYMENT_METHOD_LABELS } from '@/components/payments/payment-method-label';
import { dateCell, moneyCell, numberCell, reportRow, textCell } from '@/features/reports/cells';
import { describePeriod } from '@/features/reports/queries/sales-reports';
import type { ReportPeriod, ReportResult, ReportRow } from '@/features/reports/types';
import { daysBetween, todayIso } from '@/lib/dates';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRows, readAmount, readEnum, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PAYMENT_METHOD_TYPES } from '@/types/enums';

/** The buckets the ageing report sorts outstanding invoices into. */
const AGEING_BUCKETS = [
  { key: 'current', label: 'Not due yet', from: Number.NEGATIVE_INFINITY, to: 0 },
  { key: '1-30', label: '1 to 30 days late', from: 1, to: 30 },
  { key: '31-60', label: '31 to 60 days late', from: 31, to: 60 },
  { key: '61-90', label: '61 to 90 days late', from: 61, to: 90 },
  { key: '90+', label: 'More than 90 days late', from: 91, to: Number.POSITIVE_INFINITY },
] as const;

/**
 * Builds the receivables ageing report.
 *
 * @param companyId Company the figures belong to.
 * @param currency Currency the totals are shown in.
 * @param period Period the report covers.
 * @returns The finished report.
 */
export async function buildReceivablesAgeing(
  companyId: string,
  currency: string,
  period: ReportPeriod
): Promise<ReportResult> {
  const supabase = createServerSupabaseClient();
  const base: ReportResult = {
    reportKey: 'receivables-ageing',
    title: 'Receivables ageing',
    description: 'What is owed to you, sorted by how long it has been waiting.',
    columns: [
      { key: 'bucket', label: 'Age', kind: 'text' },
      { key: 'count', label: 'Invoices', kind: 'number' },
      { key: 'balance', label: 'Outstanding', kind: 'money' },
    ],
    rows: [],
    totalRow: reportRow('total', [textCell('TOTAL'), numberCell(0), moneyCell('0.00', currency)]),
    periodLabel: describePeriod(period),
    isDegraded: false,
  };

  const { data, error } = await supabase
    .from('invoices')
    .select('id, due_date, balance_due, status')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .gt('balance_due', 0)
    .not('status', 'in', '(draft,cancelled,written_off)')
    .lte('issue_date', period.toDate);

  if (error) {
    logger.error('Could not build the ageing report', error, { companyId });
    return { ...base, isDegraded: true };
  }

  const today = todayIso();
  const totals = new Map<string, { count: number; balance: string }>();

  for (const bucket of AGEING_BUCKETS) {
    totals.set(bucket.key, { count: 0, balance: '0' });
  }

  let grandBalance = '0';
  let grandCount = 0;

  for (const row of asRows(data)) {
    const dueDate = readString(row, 'due_date');
    const balance = readAmount(row, 'balance_due');
    const daysLate = dueDate === null ? 0 : daysBetween(dueDate, today);

    const bucket =
      AGEING_BUCKETS.find((entry) => daysLate >= entry.from && daysLate <= entry.to) ??
      AGEING_BUCKETS[0];
    const current = totals.get(bucket.key) ?? { count: 0, balance: '0' };

    totals.set(bucket.key, {
      count: current.count + 1,
      balance: toStoredAmount(addMoney(current.balance, balance)),
    });

    grandBalance = toStoredAmount(addMoney(grandBalance, balance));
    grandCount += 1;
  }

  const rows: ReportRow[] = AGEING_BUCKETS.map((bucket) => {
    const value = totals.get(bucket.key) ?? { count: 0, balance: '0' };

    return reportRow(bucket.key, [
      textCell(bucket.label),
      numberCell(value.count),
      moneyCell(value.balance, currency),
    ]);
  });

  return {
    ...base,
    rows,
    totalRow: reportRow('total', [
      textCell('TOTAL'),
      numberCell(grandCount),
      moneyCell(grandBalance, currency),
    ]),
  };
}

/**
 * Builds the list of payments received in the period.
 *
 * @param companyId Company the figures belong to.
 * @param currency Currency the totals are shown in.
 * @param period Period the report covers.
 * @returns The finished report.
 */
export async function buildPaymentsReceived(
  companyId: string,
  currency: string,
  period: ReportPeriod
): Promise<ReportResult> {
  const supabase = createServerSupabaseClient();
  const base: ReportResult = {
    reportKey: 'payments-received',
    title: 'Payments received',
    description: 'Every payment recorded in the period, with its method.',
    columns: [
      { key: 'number', label: 'Payment', kind: 'text' },
      { key: 'received', label: 'Received', kind: 'date' },
      { key: 'client', label: 'Client', kind: 'text' },
      { key: 'method', label: 'Method', kind: 'text' },
      { key: 'amount', label: 'Amount', kind: 'money' },
      { key: 'fee', label: 'Fee', kind: 'money' },
      { key: 'net', label: 'Net', kind: 'money' },
    ],
    rows: [],
    totalRow: reportRow('total', [
      textCell('TOTAL'),
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
    .from('payments')
    .select(
      'id, payment_number, received_at, method_type, amount, gateway_fee_amount, platform_fee_amount, net_amount, status, clients(display_name)'
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .eq('status', 'succeeded')
    .gte('received_at', `${period.fromDate}T00:00:00Z`)
    .lte('received_at', `${period.toDate}T23:59:59Z`)
    .order('received_at', { ascending: true });

  if (error) {
    logger.error('Could not build the payments report', error, { companyId });
    return { ...base, isDegraded: true };
  }

  let totalAmount = '0';
  let totalFee = '0';
  let totalNet = '0';

  const rows = asRows(data).map((row, index) => {
    const amount = readAmount(row, 'amount');
    const fee = toStoredAmount(
      addMoney(readAmount(row, 'gateway_fee_amount'), readAmount(row, 'platform_fee_amount'))
    );
    const net = readAmount(row, 'net_amount');

    totalAmount = toStoredAmount(addMoney(totalAmount, amount));
    totalFee = toStoredAmount(addMoney(totalFee, fee));
    totalNet = toStoredAmount(addMoney(totalNet, net));

    const joined = row['clients'];
    const clientName =
      joined !== null && typeof joined === 'object' && !Array.isArray(joined)
        ? (joined as Record<string, unknown>)['display_name']
        : null;
    const method = readEnum(row, 'method_type', PAYMENT_METHOD_TYPES, 'other');
    const receivedAt = readString(row, 'received_at');

    return reportRow(readString(row, 'id') ?? String(index), [
      textCell(readString(row, 'payment_number')),
      dateCell(receivedAt === null ? null : receivedAt.slice(0, 10)),
      textCell(typeof clientName === 'string' ? clientName : null),
      textCell(PAYMENT_METHOD_LABELS[method]),
      moneyCell(amount, currency),
      moneyCell(fee, currency),
      moneyCell(net, currency),
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
      moneyCell(totalAmount, currency),
      moneyCell(totalFee, currency),
      moneyCell(totalNet, currency),
    ]),
  };
}

/**
 * Builds the tax summary for the period.
 *
 * @param companyId Company the figures belong to.
 * @param currency Currency the totals are shown in.
 * @param period Period the report covers.
 * @returns The finished report.
 */
export async function buildTaxSummary(
  companyId: string,
  currency: string,
  period: ReportPeriod
): Promise<ReportResult> {
  const supabase = createServerSupabaseClient();
  const base: ReportResult = {
    reportKey: 'tax-summary',
    title: 'Tax summary',
    description: 'Tax charged on sales and tax paid on purchases.',
    columns: [
      { key: 'line', label: 'Line', kind: 'text' },
      { key: 'net', label: 'Net', kind: 'money' },
      { key: 'tax', label: 'Tax', kind: 'money' },
      { key: 'gross', label: 'Gross', kind: 'money' },
    ],
    rows: [],
    totalRow: reportRow('total', [
      textCell('TOTAL'),
      moneyCell('0.00', currency),
      moneyCell('0.00', currency),
      moneyCell('0.00', currency),
    ]),
    periodLabel: describePeriod(period),
    isDegraded: false,
  };

  const [salesResult, purchaseResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('taxable_amount, tax_amount, total_amount')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .not('status', 'in', '(draft,cancelled)')
      .gte('issue_date', period.fromDate)
      .lte('issue_date', period.toDate),
    supabase
      .from('expenses')
      .select('subtotal_amount, tax_amount, total_amount')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .not('status', 'eq', 'rejected')
      .gte('expense_date', period.fromDate)
      .lte('expense_date', period.toDate),
  ]);

  if (salesResult.error || purchaseResult.error) {
    logger.error('Could not build the tax summary', salesResult.error ?? purchaseResult.error, {
      companyId,
    });

    return { ...base, isDegraded: true };
  }

  let salesNet = '0';
  let salesTax = '0';

  for (const row of asRows(salesResult.data)) {
    salesNet = toStoredAmount(addMoney(salesNet, readAmount(row, 'taxable_amount')));
    salesTax = toStoredAmount(addMoney(salesTax, readAmount(row, 'tax_amount')));
  }

  let purchaseNet = '0';
  let purchaseTax = '0';

  for (const row of asRows(purchaseResult.data)) {
    purchaseNet = toStoredAmount(addMoney(purchaseNet, readAmount(row, 'subtotal_amount')));
    purchaseTax = toStoredAmount(addMoney(purchaseTax, readAmount(row, 'tax_amount')));
  }

  const salesGross = toStoredAmount(addMoney(salesNet, salesTax));
  const purchaseGross = toStoredAmount(addMoney(purchaseNet, purchaseTax));
  const netNet = toStoredAmount(addMoney(salesNet, `-${purchaseNet}`));
  const netTax = toStoredAmount(addMoney(salesTax, `-${purchaseTax}`));
  const netGross = toStoredAmount(addMoney(salesGross, `-${purchaseGross}`));

  return {
    ...base,
    rows: [
      reportRow('sales', [
        textCell('Tax charged on sales'),
        moneyCell(salesNet, currency),
        moneyCell(salesTax, currency),
        moneyCell(salesGross, currency),
      ]),
      reportRow('purchases', [
        textCell('Tax paid on purchases'),
        moneyCell(purchaseNet, currency),
        moneyCell(purchaseTax, currency),
        moneyCell(purchaseGross, currency),
      ]),
    ],
    totalRow: reportRow('total', [
      textCell('TOTAL due to the tax authority'),
      moneyCell(netNet, currency),
      moneyCell(netTax, currency),
      moneyCell(netGross, currency),
    ]),
  };
}
