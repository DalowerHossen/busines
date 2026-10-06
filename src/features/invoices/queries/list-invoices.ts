// src/features/invoices/queries/list-invoices.ts
// Reading a page of invoices for one company, with search, status, client and
// date filters.

import { toInvoiceSummary } from '@/features/invoices/mappers';
import { OPEN_INVOICE_STATUSES } from '@/features/invoices/status';
import type { InvoiceListFilters, InvoiceSummary, InvoiceTotals } from '@/features/invoices/types';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRows, readAmount, readString } from '@/lib/records';
import { escapeSearchTerm } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeSortColumn, toRange } from '@/lib/validation/pagination';
import type { ListQuery, Paginated } from '@/types/common';
import type { InvoiceStatus } from '@/types/enums';

const SORTABLE_COLUMNS = ['issue_date', 'due_date', 'total_amount', 'invoice_number'] as const;

const LIST_COLUMNS =
  'id, invoice_number, status, client_id, client_name_snapshot, currency, issue_date, due_date, total_amount, paid_amount, balance_due, is_locked, deleted_at, clients(display_name)';

export interface InvoiceListResult extends Paginated<InvoiceSummary> {
  /** True when the database could not be reached and an empty page is shown. */
  isDegraded: boolean;
}

/**
 * Lists invoices belonging to one company.
 *
 * @param companyId Company whose invoices are read.
 * @param query Paging and sorting arguments.
 * @param filters Search text and the chosen filters.
 * @returns One page of invoices.
 */
export async function listInvoices(
  companyId: string,
  query: ListQuery,
  filters: InvoiceListFilters
): Promise<InvoiceListResult> {
  const supabase = createServerSupabaseClient();
  const range = toRange(query);
  const sortColumn = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'issue_date');

  let statement = supabase
    .from('invoices')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('company_id', companyId);

  statement = filters.includeDeleted
    ? statement.not('deleted_at', 'is', null)
    : statement.is('deleted_at', null);

  if (filters.status !== null) {
    statement = statement.eq('status', filters.status);
  }

  if (filters.clientId !== null) {
    statement = statement.eq('client_id', filters.clientId);
  }

  if (filters.fromDate !== null) {
    statement = statement.gte('issue_date', filters.fromDate);
  }

  if (filters.toDate !== null) {
    statement = statement.lte('issue_date', filters.toDate);
  }

  if (filters.search !== null) {
    const term = `%${escapeSearchTerm(filters.search)}%`;
    statement = statement.or(
      `invoice_number.ilike.${term},client_name_snapshot.ilike.${term},purchase_order_reference.ilike.${term}`
    );
  }

  const { data, count, error } = await statement
    .order(sortColumn, { ascending: false, nullsFirst: false })
    .range(range.from, range.to);

  if (error) {
    logger.error('Could not list invoices', error, { companyId });

    return {
      items: [],
      totalCount: 0,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: false,
      nextCursor: null,
      isDegraded: true,
    };
  }

  const items = asRows(data).map((row) => toInvoiceSummary(row));
  const totalCount = count ?? items.length;

  return {
    items,
    totalCount,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < totalCount,
    nextCursor: null,
    isDegraded: false,
  };
}

/**
 * Totals the invoice book for the summary strip above the list.
 *
 * @param companyId Company whose invoices are totalled.
 * @param baseCurrency Currency the totals are shown in.
 * @param today The date overdue is measured against.
 * @returns The figures shown above the list.
 */
export async function summariseInvoices(
  companyId: string,
  baseCurrency: string,
  today: string
): Promise<InvoiceTotals> {
  const supabase = createServerSupabaseClient();
  const empty: InvoiceTotals = {
    currency: baseCurrency,
    outstandingTotal: '0.00',
    overdueTotal: '0.00',
    draftCount: 0,
    overdueCount: 0,
    totalCount: 0,
  };

  const { data, error } = await supabase
    .from('invoices')
    .select('status, due_date, balance_due')
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Could not summarise invoices', error, { companyId });
    return empty;
  }

  const rows = asRows(data);
  let outstandingTotal = '0';
  let overdueTotal = '0';
  let draftCount = 0;
  let overdueCount = 0;

  for (const row of rows) {
    const status = readString(row, 'status');
    const dueDate = readString(row, 'due_date');
    const balance = readAmount(row, 'balance_due');

    if (status === 'draft') {
      draftCount += 1;
      continue;
    }

    if (status === null || !OPEN_INVOICE_STATUSES.includes(status as InvoiceStatus)) {
      continue;
    }

    outstandingTotal = toStoredAmount(addMoney(outstandingTotal, balance));

    if (status === 'overdue' || (dueDate !== null && dueDate < today)) {
      overdueCount += 1;
      overdueTotal = toStoredAmount(addMoney(overdueTotal, balance));
    }
  }

  return {
    currency: baseCurrency,
    outstandingTotal,
    overdueTotal,
    draftCount,
    overdueCount,
    totalCount: rows.length,
  };
}
