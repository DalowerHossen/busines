// src/features/estimates/queries/list-estimates.ts
// Reading a page of estimates for one company, with search, status, client and
// date filters, plus the totals shown above the list.

import { toEstimateSummary } from '@/features/estimates/mappers';
import { OPEN_ESTIMATE_STATUSES } from '@/features/estimates/status';
import type {
  EstimateListFilters,
  EstimateSummary,
  EstimateTotals,
} from '@/features/estimates/types';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRows, readAmount, readString } from '@/lib/records';
import { escapeSearchTerm } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeSortColumn, toRange } from '@/lib/validation/pagination';
import type { ListQuery, Paginated } from '@/types/common';
import type { EstimateStatus } from '@/types/enums';

const SORTABLE_COLUMNS = ['issue_date', 'valid_until', 'total_amount', 'estimate_number'] as const;

const LIST_COLUMNS =
  'id, estimate_number, status, title, client_id, client_name_snapshot, currency, issue_date, valid_until, total_amount, converted_invoice_id, deleted_at, clients(display_name)';

/** How many days ahead an estimate counts as expiring soon. */
const EXPIRY_WINDOW_DAYS = 7;

export interface EstimateListResult extends Paginated<EstimateSummary> {
  /** True when the database could not be reached and an empty page is shown. */
  isDegraded: boolean;
}

/**
 * Lists estimates belonging to one company.
 *
 * @param companyId Company whose estimates are read.
 * @param query Paging and sorting arguments.
 * @param filters Search text and the chosen filters.
 * @returns One page of estimates.
 */
export async function listEstimates(
  companyId: string,
  query: ListQuery,
  filters: EstimateListFilters
): Promise<EstimateListResult> {
  const supabase = createServerSupabaseClient();
  const range = toRange(query);
  const sortColumn = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'issue_date');

  let statement = supabase
    .from('estimates')
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
      `estimate_number.ilike.${term},title.ilike.${term},client_name_snapshot.ilike.${term}`
    );
  }

  const { data, count, error } = await statement
    .order(sortColumn, { ascending: false, nullsFirst: false })
    .range(range.from, range.to);

  if (error) {
    logger.error('Could not list estimates', error, { companyId });

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

  const items = asRows(data).map((row) => toEstimateSummary(row));
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
 * Totals the quotation book for the summary strip above the list.
 *
 * @param companyId Company whose estimates are totalled.
 * @param baseCurrency Currency the totals are shown in.
 * @param today The date the validity window is measured from.
 * @returns The figures shown above the list.
 */
export async function summariseEstimates(
  companyId: string,
  baseCurrency: string,
  today: string
): Promise<EstimateTotals> {
  const supabase = createServerSupabaseClient();
  const empty: EstimateTotals = {
    currency: baseCurrency,
    openTotal: '0.00',
    approvedTotal: '0.00',
    draftCount: 0,
    expiringCount: 0,
    totalCount: 0,
  };

  const { data, error } = await supabase
    .from('estimates')
    .select('status, valid_until, total_amount')
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Could not summarise estimates', error, { companyId });
    return empty;
  }

  const rows = asRows(data);
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + EXPIRY_WINDOW_DAYS);
  const horizonIso = horizon.toISOString().slice(0, 10);

  let openTotal = '0';
  let approvedTotal = '0';
  let draftCount = 0;
  let expiringCount = 0;

  for (const row of rows) {
    const status = readString(row, 'status');
    const validUntil = readString(row, 'valid_until');
    const total = readAmount(row, 'total_amount');

    if (status === 'draft') {
      draftCount += 1;
      continue;
    }

    if (status === 'approved') {
      approvedTotal = toStoredAmount(addMoney(approvedTotal, total));
      continue;
    }

    if (status === null || !OPEN_ESTIMATE_STATUSES.includes(status as EstimateStatus)) {
      continue;
    }

    openTotal = toStoredAmount(addMoney(openTotal, total));

    if (validUntil !== null && validUntil <= horizonIso) {
      expiringCount += 1;
    }
  }

  return {
    currency: baseCurrency,
    openTotal,
    approvedTotal,
    draftCount,
    expiringCount,
    totalCount: rows.length,
  };
}
