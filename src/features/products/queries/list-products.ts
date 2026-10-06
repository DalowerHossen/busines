// src/features/products/queries/list-products.ts
// Reading a page of the catalogue for one company, with search, filters and
// paging. Every read stays inside the tenant.

import { toProductSummary } from '@/features/products/mappers';
import type { ProductListFilters, ProductSummary } from '@/features/products/types';
import { logger } from '@/lib/logger';
import { asRows } from '@/lib/records';
import { escapeSearchTerm } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeSortColumn, toRange } from '@/lib/validation/pagination';
import type { ListQuery, Paginated } from '@/types/common';

const SORTABLE_COLUMNS = ['name', 'sku', 'unit_price', 'created_at'] as const;

const LIST_COLUMNS =
  'id, name, sku, product_type, status, unit_price, currency, track_inventory, deleted_at, product_categories(name)';

export interface ProductListResult extends Paginated<ProductSummary> {
  /** True when the database could not be reached and an empty page is shown. */
  isDegraded: boolean;
}

/**
 * Lists catalogue items belonging to one company.
 *
 * @param companyId Company whose catalogue is read.
 * @param query Paging and sorting arguments.
 * @param filters Search text and the chosen filters.
 * @returns One page of catalogue items.
 */
export async function listProducts(
  companyId: string,
  query: ListQuery,
  filters: ProductListFilters
): Promise<ProductListResult> {
  const supabase = createServerSupabaseClient();
  const range = toRange(query);
  const sortColumn = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'name');
  const ascending = sortColumn === 'name' || sortColumn === 'sku';

  let statement = supabase
    .from('products')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('company_id', companyId);

  statement = filters.includeDeleted
    ? statement.not('deleted_at', 'is', null)
    : statement.is('deleted_at', null);

  if (filters.status !== null) {
    statement = statement.eq('status', filters.status);
  }

  if (filters.productType !== null) {
    statement = statement.eq('product_type', filters.productType);
  }

  if (filters.categoryId !== null) {
    statement = statement.eq('category_id', filters.categoryId);
  }

  if (filters.search !== null) {
    const term = `%${escapeSearchTerm(filters.search)}%`;
    statement = statement.or(
      `name.ilike.${term},sku.ilike.${term},barcode.ilike.${term},description.ilike.${term}`
    );
  }

  const { data, count, error } = await statement
    .order(sortColumn, { ascending, nullsFirst: false })
    .range(range.from, range.to);

  if (error) {
    logger.error('Could not list catalogue items', error, { companyId });

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

  const items = asRows(data).map((row) => toProductSummary(row));
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

export interface ProductCounts {
  total: number;
  active: number;
  services: number;
  tracked: number;
}

/**
 * Counts the catalogue for the summary strip above the list.
 *
 * @param companyId Company whose catalogue is counted.
 * @returns The counts shown above the list.
 */
export async function countProducts(companyId: string): Promise<ProductCounts> {
  const supabase = createServerSupabaseClient();
  const empty: ProductCounts = { total: 0, active: 0, services: 0, tracked: 0 };

  const { data, error } = await supabase
    .from('products')
    .select('status, product_type, track_inventory')
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Could not count catalogue items', error, { companyId });
    return empty;
  }

  return asRows(data).reduce<ProductCounts>((totals, row) => {
    const next: ProductCounts = { ...totals, total: totals.total + 1 };

    if (row['status'] === 'active') {
      next.active += 1;
    }

    if (row['product_type'] === 'service') {
      next.services += 1;
    }

    if (row['track_inventory'] === true) {
      next.tracked += 1;
    }

    return next;
  }, empty);
}
