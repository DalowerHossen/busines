// src/types/common.ts
// Shared shapes used by server actions, API routes and the interface layer.

export type Nullable<Value> = Value | null;

export type SortDirection = 'asc' | 'desc';

/** The outcome every server action returns, successful or not. */
export type ActionResult<Data = undefined> =
  | { success: true; data: Data }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/** A page of rows plus the information needed to request the next page. */
export interface Paginated<Item> {
  items: Item[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

/** Query arguments accepted by every list endpoint. */
export interface ListQuery {
  page: number;
  pageSize: number;
  search: string | null;
  sortBy: string | null;
  sortDirection: SortDirection;
  cursor: string | null;
}

/** An option rendered in a select control. */
export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** A breadcrumb entry shown above a page title. */
export interface Breadcrumb {
  label: string;
  href?: string;
}

/** The four states every asynchronous view must be able to render. */
export type ViewState = 'loading' | 'error' | 'empty' | 'ready';

/** A money amount kept as a string so no precision is lost in transit. */
export interface MoneyAmount {
  amount: string;
  currency: string;
}

/** A date range, inclusive of both ends, in ISO 8601 date form. */
export interface DateRange {
  from: string;
  to: string;
}
