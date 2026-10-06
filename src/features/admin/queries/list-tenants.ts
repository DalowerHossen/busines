// src/features/admin/queries/list-tenants.ts
// Reading a page of tenants for the platform console, with search and the
// two filters support actually uses: what state they are in, and whether
// their identity checks are outstanding.

import type { TenantListFilters, TenantSummary } from '@/features/admin/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readBoolean, readEnum, readString } from '@/lib/records';
import { escapeSearchTerm } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeSortColumn, toRange } from '@/lib/validation/pagination';
import type { ListQuery, Paginated } from '@/types/common';
import type { DatabaseRow } from '@/types/database';
import { COMPANY_STATUSES, KYC_STATUSES, SUBSCRIPTION_STATUSES } from '@/types/enums';

const SORTABLE_COLUMNS = ['created_at', 'display_name', 'status'] as const;

export interface TenantListResult extends Paginated<TenantSummary> {
  /** True when the list could not be read and an empty page is shown. */
  isDegraded: boolean;
}

/**
 * Maps one tenant row.
 *
 * @param row Row read from public.companies.
 * @returns The tenant the table renders.
 */
export function toTenantSummary(row: DatabaseRow): TenantSummary {
  const subscription = asRows(row['subscriptions'])[0] ?? null;
  const plan = subscription === null ? null : asRow(subscription['subscription_plans']);

  return {
    id: readString(row, 'id') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    legalName: readString(row, 'legal_name') ?? '',
    slug: readString(row, 'slug') ?? '',
    status: readEnum(row, 'status', COMPANY_STATUSES, 'onboarding'),
    kycStatus: readEnum(row, 'kyc_status', KYC_STATUSES, 'not_started'),
    countryCode: readString(row, 'country_code') ?? 'US',
    baseCurrency: readString(row, 'base_currency') ?? 'USD',
    morEnabled: readBoolean(row, 'mor_enabled'),
    suspensionReason: readString(row, 'suspension_reason'),
    createdAt: readString(row, 'created_at') ?? '',
    planName: plan === null ? null : readString(plan, 'name'),
    subscriptionStatus:
      subscription === null
        ? null
        : readEnum(subscription, 'status', SUBSCRIPTION_STATUSES, 'active'),
    planAmount: subscription === null ? null : readAmount(subscription, 'amount'),
  };
}

/**
 * Lists the tenants on the platform.
 *
 * @param query Paging and sorting arguments.
 * @param filters Search text and the state filters.
 * @returns One page of tenants.
 */
export async function listTenants(
  query: ListQuery,
  filters: TenantListFilters
): Promise<TenantListResult> {
  const supabase = createServerSupabaseClient();
  const range = toRange(query);
  const sortColumn = safeSortColumn(query.sortBy, SORTABLE_COLUMNS, 'created_at');

  let statement = supabase
    .from('companies')
    .select(
      'id, display_name, legal_name, slug, status, kyc_status, country_code, base_currency, mor_enabled, suspension_reason, created_at, subscriptions(status, amount, subscription_plans(name))',
      { count: 'exact' }
    )
    .is('deleted_at', null);

  if (filters.status !== null) {
    statement = statement.eq('status', filters.status);
  }

  if (filters.kycStatus !== null) {
    statement = statement.eq('kyc_status', filters.kycStatus);
  }

  if (filters.search !== null) {
    const term = `%${escapeSearchTerm(filters.search)}%`;
    statement = statement.or(
      `display_name.ilike.${term},legal_name.ilike.${term},slug.ilike.${term}`
    );
  }

  const {
    data,
    count: totalCount,
    error,
  } = await statement
    .order(sortColumn, { ascending: sortColumn === 'display_name', nullsFirst: false })
    .range(range.from, range.to);

  if (error) {
    logger.error('The tenant list could not be read', error);

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

  const items = asRows(data).map(toTenantSummary);
  const total = totalCount ?? items.length;

  return {
    items,
    totalCount: total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: range.to + 1 < total,
    nextCursor: null,
    isDegraded: false,
  };
}
