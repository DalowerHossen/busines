// src/features/expenses/queries/list-expenses.ts
// Reading what a company has spent, and totalling it for the strip above the
// list.

import { toExpenseSummary } from '@/features/expenses/mappers';
import type { ExpenseListFilters, ExpenseSummary, ExpenseTotals } from '@/features/expenses/types';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRows } from '@/lib/records';
import { escapeSearchTerm } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { toRange } from '@/lib/validation/pagination';
import type { ListQuery, Paginated } from '@/types/common';

const LIST_COLUMNS =
  'id, expense_number, status, description, expense_date, vendor_id, category_id, currency, total_amount, is_paid, is_billable, is_reimbursable, invoiced_at, client_id, deleted_at, vendors(display_name), expense_categories(name), clients(display_name)';

export interface ExpenseListResult extends Paginated<ExpenseSummary> {
  /** True when the database could not be reached and an empty page is shown. */
  isDegraded: boolean;
}

/**
 * Lists the expense claims of one company.
 *
 * @param companyId Company whose spending is read.
 * @param query Paging arguments.
 * @param filters Search text and the chosen filters.
 * @returns One page of claims.
 */
export async function listExpenses(
  companyId: string,
  query: ListQuery,
  filters: ExpenseListFilters
): Promise<ExpenseListResult> {
  const supabase = createServerSupabaseClient();
  const range = toRange(query);

  let statement = supabase
    .from('expenses')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('company_id', companyId);

  statement = filters.includeDeleted
    ? statement.not('deleted_at', 'is', null)
    : statement.is('deleted_at', null);

  if (filters.status !== null) {
    statement = statement.eq('status', filters.status);
  }

  if (filters.vendorId !== null) {
    statement = statement.eq('vendor_id', filters.vendorId);
  }

  if (filters.categoryId !== null) {
    statement = statement.eq('category_id', filters.categoryId);
  }

  if (filters.fromDate !== null) {
    statement = statement.gte('expense_date', filters.fromDate);
  }

  if (filters.toDate !== null) {
    statement = statement.lte('expense_date', filters.toDate);
  }

  if (filters.search !== null) {
    const term = `%${escapeSearchTerm(filters.search)}%`;
    statement = statement.or(
      `description.ilike.${term},expense_number.ilike.${term},reference.ilike.${term}`
    );
  }

  const { data, count, error } = await statement
    .order('expense_date', { ascending: false })
    .range(range.from, range.to);

  if (error) {
    logger.error('Could not list the expenses', error, { companyId });

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

  const items = asRows(data).map((row) => toExpenseSummary(row));
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
 * Totals the spending for the summary strip above the list.
 *
 * @param companyId Company whose spending is totalled.
 * @param baseCurrency Currency the totals are shown in.
 * @returns The figures shown above the list.
 */
export async function summariseExpenses(
  companyId: string,
  baseCurrency: string
): Promise<ExpenseTotals> {
  const supabase = createServerSupabaseClient();
  const empty: ExpenseTotals = {
    currency: baseCurrency,
    totalSpend: '0.00',
    awaitingPayment: '0.00',
    rechargeable: '0.00',
    awaitingApprovalCount: 0,
    totalCount: 0,
  };

  const { data, error } = await supabase
    .from('expenses')
    .select(LIST_COLUMNS)
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Could not summarise the expenses', error, { companyId });
    return empty;
  }

  const rows = asRows(data).map((row) => toExpenseSummary(row));

  let totalSpend = '0';
  let awaitingPayment = '0';
  let rechargeable = '0';
  let awaitingApprovalCount = 0;

  for (const expense of rows) {
    if (expense.status === 'rejected') {
      continue;
    }

    totalSpend = toStoredAmount(addMoney(totalSpend, expense.totalAmount));

    if (!expense.isPaid && expense.status !== 'draft') {
      awaitingPayment = toStoredAmount(addMoney(awaitingPayment, expense.totalAmount));
    }

    if (expense.isBillable && expense.invoicedAt === null) {
      rechargeable = toStoredAmount(addMoney(rechargeable, expense.totalAmount));
    }

    if (expense.status === 'submitted') {
      awaitingApprovalCount += 1;
    }
  }

  return {
    currency: baseCurrency,
    totalSpend,
    awaitingPayment,
    rechargeable,
    awaitingApprovalCount,
    totalCount: rows.length,
  };
}
