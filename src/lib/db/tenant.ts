// src/lib/db/tenant.ts
// Every read and write in the application goes through one of these helpers,
// because every one of them applies the two filters that keep tenants apart:
// the company identifier and the soft delete marker.

import 'server-only';

import { AppError, notFoundError } from '@/lib/errors';
import { asRow, asRows } from '@/lib/records';
import { logger } from '@/lib/logger';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import type { ServiceSupabaseClient } from '@/lib/supabase/service';
import type { ListQuery, Paginated } from '@/types/common';
import { toPage, toRange } from '@/lib/validation/pagination';
import type { DatabaseRow, DatabaseWrite } from '@/types/database';

export type TenantClient = ServerSupabaseClient | ServiceSupabaseClient;

export interface TenantQueryOptions {
  columns?: string;
  includeDeleted?: boolean;
}

/**
 * Starts a select that is already scoped to one company.
 *
 * @param client Supabase client to query through.
 * @param table Table to read.
 * @param companyId Company that owns the rows.
 * @param options Columns to read and whether deleted rows are wanted.
 * @returns A query builder with the tenant filters applied.
 */
export function scopedSelect(
  client: TenantClient,
  table: string,
  companyId: string,
  options: TenantQueryOptions = {}
) {
  const query = client
    .from(table)
    .select(options.columns ?? '*', { count: 'exact' })
    .eq('company_id', companyId);

  return options.includeDeleted ? query : query.is('deleted_at', null);
}

/**
 * Reads one row by identifier inside a company.
 *
 * @param client Supabase client to query through.
 * @param table Table to read.
 * @param companyId Company that owns the row.
 * @param id Identifier of the row.
 * @param options Columns to read.
 * @returns The row, or null when it does not exist.
 */
export async function findById(
  client: TenantClient,
  table: string,
  companyId: string,
  id: string,
  options: TenantQueryOptions = {}
): Promise<DatabaseRow | null> {
  const { data, error } = await scopedSelect(client, table, companyId, options)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error('A record could not be read', error, { table });
    throw new AppError('database_failure', 'The record could not be read.');
  }

  return asRow(data);
}

/**
 * Reads one row by identifier and refuses to continue without it.
 *
 * @param client Supabase client to query through.
 * @param table Table to read.
 * @param companyId Company that owns the row.
 * @param id Identifier of the row.
 * @param subject Name used in the error message.
 * @param options Columns to read.
 * @returns The row.
 */
export async function requireById(
  client: TenantClient,
  table: string,
  companyId: string,
  id: string,
  subject: string,
  options: TenantQueryOptions = {}
): Promise<DatabaseRow> {
  const row = await findById(client, table, companyId, id, options);

  if (!row) {
    throw notFoundError(subject);
  }

  return row;
}

export interface ListOptions extends TenantQueryOptions {
  orderBy?: string;
  ascending?: boolean;
}

/**
 * Reads a page of rows inside a company.
 *
 * @param client Supabase client to query through.
 * @param table Table to read.
 * @param companyId Company that owns the rows.
 * @param query Page, size and sort chosen by the caller.
 * @param options Columns to read and the column to order by.
 * @returns A page of rows with the total count.
 */
export async function listPage(
  client: TenantClient,
  table: string,
  companyId: string,
  query: ListQuery,
  options: ListOptions = {}
): Promise<Paginated<DatabaseRow>> {
  const range = toRange(query);
  const { data, error, count } = await scopedSelect(client, table, companyId, options)
    .order(options.orderBy ?? 'created_at', { ascending: options.ascending ?? false })
    .range(range.from, range.to);

  if (error) {
    logger.error('A list could not be read', error, { table });
    throw new AppError('database_failure', 'The list could not be loaded.');
  }

  return toPage(asRows(data), count ?? 0, query);
}

/**
 * Inserts a row, forcing it to belong to the company.
 *
 * @param client Supabase client to write through.
 * @param table Table to write to.
 * @param companyId Company that will own the row.
 * @param values Columns to write.
 * @param columns Columns to read back.
 * @returns The inserted row.
 */
export async function insertScoped(
  client: TenantClient,
  table: string,
  companyId: string,
  values: DatabaseWrite,
  columns = '*'
): Promise<DatabaseRow> {
  const { data, error } = await client
    .from(table)
    .insert({ ...values, company_id: companyId })
    .select(columns)
    .single();

  if (error) {
    logger.error('A record could not be created', error, { table });
    throw new AppError('database_failure', 'The record could not be saved.');
  }

  const row = asRow(data);

  if (!row) {
    throw new AppError('database_failure', 'The record could not be saved.');
  }

  return row;
}

/**
 * Updates a row inside a company.
 *
 * @param client Supabase client to write through.
 * @param table Table to write to.
 * @param companyId Company that owns the row.
 * @param id Identifier of the row.
 * @param values Columns to change.
 * @param columns Columns to read back.
 * @returns The updated row.
 */
export async function updateScoped(
  client: TenantClient,
  table: string,
  companyId: string,
  id: string,
  values: DatabaseWrite,
  columns = '*'
): Promise<DatabaseRow> {
  const { data, error } = await client
    .from(table)
    .update(values)
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .select(columns)
    .maybeSingle();

  if (error) {
    logger.error('A record could not be updated', error, { table });
    throw new AppError('database_failure', 'The change could not be saved.');
  }

  const row = asRow(data);

  if (!row) {
    throw notFoundError('Record');
  }

  return row;
}

/**
 * Marks a row as deleted without removing it.
 *
 * @param client Supabase client to write through.
 * @param table Table to write to.
 * @param companyId Company that owns the row.
 * @param id Identifier of the row.
 * @returns Nothing.
 */
export async function softDeleteScoped(
  client: TenantClient,
  table: string,
  companyId: string,
  id: string
): Promise<void> {
  const { error } = await client
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('A record could not be deleted', error, { table });
    throw new AppError('database_failure', 'The record could not be deleted.');
  }
}

/**
 * Counts the rows matching the tenant filters.
 *
 * @param client Supabase client to query through.
 * @param table Table to count.
 * @param companyId Company that owns the rows.
 * @returns The number of rows.
 */
export async function countScoped(
  client: TenantClient,
  table: string,
  companyId: string
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .is('deleted_at', null);

  if (error) {
    logger.error('A count could not be read', error, { table });
    throw new AppError('database_failure', 'The total could not be calculated.');
  }

  return count ?? 0;
}
