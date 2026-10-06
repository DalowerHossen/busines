// src/lib/validation/pagination.ts
// One way to read list arguments, whether they arrive from a form, a search
// parameter object or an API query string.

import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/config/app';
import type { ListQuery, Paginated, SortDirection } from '@/types/common';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(120).optional(),
  sortBy: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9_.]+$/, 'Sort by a column name.')
    .optional(),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  cursor: z.string().trim().max(200).optional(),
});

export type ListQueryInput = z.input<typeof listQuerySchema>;

/**
 * Reads list arguments from a plain object, falling back to safe defaults.
 *
 * @param input Raw arguments, usually from a URL.
 * @returns A complete list query.
 */
export function parseListQuery(input: unknown): ListQuery {
  const parsed = listQuerySchema.safeParse(input ?? {});

  if (!parsed.success) {
    return {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      search: null,
      sortBy: null,
      sortDirection: 'desc',
      cursor: null,
    };
  }

  return {
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    search: parsed.data.search && parsed.data.search.length > 0 ? parsed.data.search : null,
    sortBy: parsed.data.sortBy ?? null,
    sortDirection: parsed.data.sortDirection,
    cursor: parsed.data.cursor ?? null,
  };
}

/**
 * Converts a page number into the row range PostgREST expects.
 *
 * @param query List query to translate.
 * @returns The inclusive first and last row index.
 */
export function toRange(query: ListQuery): { from: number; to: number } {
  const from = (query.page - 1) * query.pageSize;
  return { from, to: from + query.pageSize - 1 };
}

/**
 * Builds the page envelope returned to the interface.
 *
 * @param items Rows on this page.
 * @param totalCount Total rows matching the filter.
 * @param query The query that produced the page.
 * @param nextCursor Cursor for the following page, when one is used.
 * @returns A page of results.
 */
export function toPage<Item>(
  items: Item[],
  totalCount: number,
  query: ListQuery,
  nextCursor: string | null = null
): Paginated<Item> {
  return {
    items,
    totalCount,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < totalCount,
    nextCursor,
  };
}

/**
 * Chooses a sort column from a list the caller is allowed to sort by.
 *
 * @param requested Column asked for in the query.
 * @param allowed Columns that may be sorted on.
 * @param fallback Column used when the request is not allowed.
 * @returns A safe column name.
 */
export function safeSortColumn(
  requested: string | null,
  allowed: readonly string[],
  fallback: string
): string {
  return requested && allowed.includes(requested) ? requested : fallback;
}

/**
 * Reports whether a sort direction means ascending order.
 *
 * @param direction Direction from the query.
 * @returns True for ascending.
 */
export function isAscending(direction: SortDirection): boolean {
  return direction === 'asc';
}
