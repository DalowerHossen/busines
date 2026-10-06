// src/features/payments/queries/list-payments.ts
// Reading a page of received money for one company, and the totals shown
// above the list.

import { toPaymentSummary } from '@/features/payments/mappers';
import type { PaymentListFilters, PaymentSummary, PaymentTotals } from '@/features/payments/types';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRows, readAmount, readString } from '@/lib/records';
import { escapeSearchTerm } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { toRange } from '@/lib/validation/pagination';
import type { ListQuery, Paginated } from '@/types/common';

const LIST_COLUMNS =
  'id, payment_number, status, method_type, provider, client_id, amount, currency, allocated_amount, unallocated_amount, received_at, provider_payment_reference, bank_reference, is_manual, deleted_at, clients(display_name)';

export interface PaymentListResult extends Paginated<PaymentSummary> {
  /** True when the database could not be reached and an empty page is shown. */
  isDegraded: boolean;
}

/**
 * Lists payments belonging to one company.
 *
 * @param companyId Company whose payments are read.
 * @param query Paging arguments.
 * @param filters Search text and the chosen filters.
 * @returns One page of payments.
 */
export async function listPayments(
  companyId: string,
  query: ListQuery,
  filters: PaymentListFilters
): Promise<PaymentListResult> {
  const supabase = createServerSupabaseClient();
  const range = toRange(query);

  let statement = supabase
    .from('payments')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('company_id', companyId);

  statement = filters.includeDeleted
    ? statement.not('deleted_at', 'is', null)
    : statement.is('deleted_at', null);

  if (filters.clientId !== null) {
    statement = statement.eq('client_id', filters.clientId);
  }

  if (filters.methodType !== null) {
    statement = statement.eq('method_type', filters.methodType);
  }

  if (filters.fromDate !== null) {
    statement = statement.gte('received_at', `${filters.fromDate}T00:00:00Z`);
  }

  if (filters.toDate !== null) {
    statement = statement.lte('received_at', `${filters.toDate}T23:59:59Z`);
  }

  if (filters.onlyUnallocated) {
    statement = statement.gt('unallocated_amount', 0);
  }

  if (filters.search !== null) {
    const term = `%${escapeSearchTerm(filters.search)}%`;
    statement = statement.or(
      `payment_number.ilike.${term},provider_payment_reference.ilike.${term},bank_reference.ilike.${term},payer_name.ilike.${term}`
    );
  }

  const { data, count, error } = await statement
    .order('received_at', { ascending: false })
    .range(range.from, range.to);

  if (error) {
    logger.error('Could not list payments', error, { companyId });

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

  const items = asRows(data).map((row) => toPaymentSummary(row));
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
 * Totals the money received for the summary strip above the list.
 *
 * @param companyId Company whose payments are totalled.
 * @param baseCurrency Currency the totals are shown in.
 * @param monthStart First day of the month being reported, as YYYY-MM-DD.
 * @returns The figures shown above the list.
 */
export async function summarisePayments(
  companyId: string,
  baseCurrency: string,
  monthStart: string
): Promise<PaymentTotals> {
  const supabase = createServerSupabaseClient();
  const empty: PaymentTotals = {
    currency: baseCurrency,
    receivedThisMonth: '0.00',
    unallocatedTotal: '0.00',
    paymentCount: 0,
    unallocatedCount: 0,
  };

  const { data, error } = await supabase
    .from('payments')
    .select('status, received_at, amount_in_base_currency, amount, unallocated_amount')
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Could not summarise payments', error, { companyId });
    return empty;
  }

  const rows = asRows(data);
  let receivedThisMonth = '0';
  let unallocatedTotal = '0';
  let unallocatedCount = 0;

  for (const row of rows) {
    if (readString(row, 'status') !== 'succeeded') {
      continue;
    }

    const receivedAt = readString(row, 'received_at');
    const inBase = readAmount(row, 'amount_in_base_currency', '0');
    const amount = Number.parseFloat(inBase) > 0 ? inBase : readAmount(row, 'amount');

    if (receivedAt !== null && receivedAt.slice(0, 10) >= monthStart) {
      receivedThisMonth = toStoredAmount(addMoney(receivedThisMonth, amount));
    }

    const unallocated = readAmount(row, 'unallocated_amount');

    if (Number.parseFloat(unallocated) > 0) {
      unallocatedCount += 1;
      unallocatedTotal = toStoredAmount(addMoney(unallocatedTotal, unallocated));
    }
  }

  return {
    currency: baseCurrency,
    receivedThisMonth,
    unallocatedTotal,
    paymentCount: rows.length,
    unallocatedCount,
  };
}
