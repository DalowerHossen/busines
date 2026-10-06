// src/features/dashboard/queries/overview.ts
// The figures behind the dashboard. Every query is filtered by company and
// skips soft deleted rows, and a failure returns an honest degraded result
// rather than an empty page that pretends everything is zero.

import 'server-only';

import { addMoney } from '@/lib/money';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { InvoiceStatus } from '@/types/enums';

/** Statuses that still owe money. */
const OPEN_STATUSES: readonly InvoiceStatus[] = [
  'sent',
  'viewed',
  'partially_paid',
  'overdue',
  'disputed',
];

export interface DashboardInvoice {
  id: string;
  number: string;
  clientName: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: string;
  balanceDue: string;
}

export interface DashboardOverview {
  /** True when at least one figure could not be read. */
  isDegraded: boolean;
  currency: string;
  outstandingTotal: string;
  overdueTotal: string;
  paidThisMonthTotal: string;
  draftCount: number;
  overdueCount: number;
  clientCount: number;
  invoiceCount: number;
  recentInvoices: DashboardInvoice[];
}

/**
 * Returns the first day of the current month, in ISO 8601 date form.
 *
 * @returns The first day of this month.
 */
function startOfMonth(): string {
  const now = new Date();

  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Turns an invoice row into the shape the dashboard renders.
 *
 * @param row Row read from public.invoices.
 * @returns The invoice as the dashboard needs it.
 */
function toDashboardInvoice(record: DatabaseRow): DashboardInvoice {
  return {
    id: readString(record, 'id') ?? '',
    number: readString(record, 'invoice_number') ?? 'Draft',
    clientName: readString(record, 'client_name_snapshot') ?? 'Client',
    status: (readString(record, 'status') ?? 'draft') as InvoiceStatus,
    issueDate: readString(record, 'issue_date') ?? '',
    dueDate: readString(record, 'due_date') ?? '',
    currency: readString(record, 'currency') ?? 'USD',
    total: readAmount(record, 'total_amount'),
    balanceDue: readAmount(record, 'balance_due'),
  };
}

/**
 * Reads everything the dashboard shows for one business.
 *
 * @param companyId Business being worked inside.
 * @param baseCurrency Currency the business keeps its books in.
 * @returns The figures, with a flag when something could not be read.
 */
export async function loadDashboardOverview(
  companyId: string,
  baseCurrency: string
): Promise<DashboardOverview> {
  const supabase = createServerSupabaseClient();
  const overview: DashboardOverview = {
    isDegraded: false,
    currency: baseCurrency,
    outstandingTotal: '0',
    overdueTotal: '0',
    paidThisMonthTotal: '0',
    draftCount: 0,
    overdueCount: 0,
    clientCount: 0,
    invoiceCount: 0,
    recentInvoices: [],
  };

  const openInvoices = supabase
    .from('invoices')
    .select('status, balance_due, total_in_base_currency, total_amount')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .in('status', [...OPEN_STATUSES]);

  const paidInvoices = supabase
    .from('payments')
    .select('amount_in_base_currency, received_at')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .eq('status', 'succeeded')
    .gte('received_at', startOfMonth());

  const draftInvoices = supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .eq('status', 'draft');

  const allInvoices = supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .is('deleted_at', null);

  const clients = supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .is('deleted_at', null);

  const recent = supabase
    .from('invoices')
    .select(
      'id, invoice_number, client_name_snapshot, status, issue_date, due_date, currency, total_amount, balance_due'
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const [openResult, paymentResult, draftResult, invoiceResult, clientResult, recentResult] =
    await Promise.all([openInvoices, paidInvoices, draftInvoices, allInvoices, clients, recent]);

  if (openResult.error) {
    overview.isDegraded = true;
    logger.error('The outstanding total could not be read', openResult.error, {
      companyId,
    });
  } else {
    let outstanding = addMoney('0');
    let overdue = addMoney('0');
    let overdueCount = 0;

    for (const row of asRows(openResult.data)) {
      const balance = readAmount(row, 'balance_due');
      outstanding = outstanding.plus(balance);

      if (readString(row, 'status') === 'overdue') {
        overdue = overdue.plus(balance);
        overdueCount += 1;
      }
    }

    overview.outstandingTotal = outstanding.toFixed(2);
    overview.overdueTotal = overdue.toFixed(2);
    overview.overdueCount = overdueCount;
  }

  if (paymentResult.error) {
    overview.isDegraded = true;
    logger.error('The payments of this month could not be read', paymentResult.error, {
      companyId,
    });
  } else {
    let received = addMoney('0');

    for (const row of asRows(paymentResult.data)) {
      received = received.plus(readAmount(row, 'amount_in_base_currency'));
    }

    overview.paidThisMonthTotal = received.toFixed(2);
  }

  if (draftResult.error) {
    overview.isDegraded = true;
  } else {
    overview.draftCount = draftResult.count ?? 0;
  }

  if (invoiceResult.error) {
    overview.isDegraded = true;
  } else {
    overview.invoiceCount = invoiceResult.count ?? 0;
  }

  if (clientResult.error) {
    overview.isDegraded = true;
  } else {
    overview.clientCount = clientResult.count ?? 0;
  }

  if (recentResult.error) {
    overview.isDegraded = true;
  } else {
    overview.recentInvoices = asRows(recentResult.data).map((row) => toDashboardInvoice(row));
  }

  return overview;
}
