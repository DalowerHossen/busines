// src/features/clients/queries/list-clients.ts
// Reading a page of clients for one company, with search, status filter and
// paging. The query always stays inside the tenant and hides deleted rows
// unless the caller asks for them on purpose.

import { toClientSummary } from '@/features/clients/mappers';
import type { ClientListFilters, ClientSummary } from '@/features/clients/types';
import { logger } from '@/lib/logger';
import { asRows } from '@/lib/records';
import { escapeSearchTerm } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeSortColumn, toRange } from '@/lib/validation/pagination';
import type { ListQuery, Paginated } from '@/types/common';

const SORTABLE_COLUMNS = [
  'display_name',
  'client_number',
  'created_at',
  'last_invoiced_at',
] as const;

export interface ClientListResult extends Paginated<ClientSummary> {
  /** True when the database could not be reached and an empty page is shown. */
  isDegraded: boolean;
}

/**
 * Lists clients belonging to one company.
 *
 * @param companyId Company whose clients are read.
 * @param query Paging and sorting arguments.
 * @param filters Search text, status and deleted toggle.
 * @returns One page of clients.
 */
export async function listClients(
  companyId: string,
  query: ListQuery,
  filters: ClientListFilters
): Promise<ClientListResult> {
  const supabase = createServerSupabaseClient();
  const range = toRange(query);
  const sortColumn = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'display_name');
  const ascending = sortColumn === 'display_name' || sortColumn === 'client_number';

  let statement = supabase
    .from('clients')
    .select(
      'id, client_number, display_name, client_type, status, email, phone, country_code, billing_currency, last_invoiced_at, deleted_at',
      { count: 'exact' }
    )
    .eq('company_id', companyId);

  statement = filters.includeDeleted
    ? statement.not('deleted_at', 'is', null)
    : statement.is('deleted_at', null);

  if (filters.status !== null) {
    statement = statement.eq('status', filters.status);
  }

  if (filters.search !== null) {
    const term = `%${escapeSearchTerm(filters.search)}%`;
    statement = statement.or(
      `display_name.ilike.${term},client_number.ilike.${term},email.ilike.${term},phone.ilike.${term},legal_name.ilike.${term}`
    );
  }

  const { data, count, error } = await statement
    .order(sortColumn, { ascending, nullsFirst: false })
    .range(range.from, range.to);

  if (error) {
    logger.error('Could not list clients', error, { companyId });

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

  const items = asRows(data).map((row) => toClientSummary(row));
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

export interface ClientCounts {
  total: number;
  active: number;
  inactive: number;
  archived: number;
}

/**
 * Counts clients by status for the summary strip above the list.
 *
 * @param companyId Company whose clients are counted.
 * @returns The count of clients in each status.
 */
export async function countClientsByStatus(companyId: string): Promise<ClientCounts> {
  const supabase = createServerSupabaseClient();
  const empty: ClientCounts = { total: 0, active: 0, inactive: 0, archived: 0 };

  const { data, error } = await supabase
    .from('clients')
    .select('status')
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Could not count clients', error, { companyId });
    return empty;
  }

  return asRows(data).reduce<ClientCounts>((totals, row) => {
    const status = row['status'];
    const next: ClientCounts = { ...totals, total: totals.total + 1 };

    if (status === 'active') {
      next.active += 1;
    } else if (status === 'inactive') {
      next.inactive += 1;
    } else if (status === 'archived') {
      next.archived += 1;
    }

    return next;
  }, empty);
}
