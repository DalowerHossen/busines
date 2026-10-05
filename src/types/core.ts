// src/types/core.ts
// Foundational types shared across every domain area. Nothing here is
// specific to invoicing, payments, or auth - those live in their own
// `src/types/*.ts` files and build on top of these primitives.

/**
 * A Postgres UUID primary key, represented as a branded string so a plain
 * `string` cannot be passed where an id is expected by mistake.
 */
export type UUID = string & { readonly __brand: 'UUID' };

/**
 * An ISO-8601 timestamp string (e.g. `2026-10-03T12:00:00.000Z`), always
 * stored and transmitted in UTC.
 */
export type ISODateString = string & { readonly __brand: 'ISODateString' };

/**
 * A three-letter ISO 4217 currency code (e.g. `USD`, `BDT`, `EUR`). The full
 * list of supported currencies is defined in Phase 4's central constants.
 */
export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };

/**
 * A two-letter ISO 3166-1 alpha-2 country code (e.g. `US`, `BD`, `GB`). The
 * full list of supported countries is defined in Phase 4's central
 * constants.
 */
export type CountryCode = string & { readonly __brand: 'CountryCode' };

/**
 * A monetary amount stored and transmitted as a decimal-safe string (never
 * a floating point `number`) to avoid rounding errors. Arithmetic on this
 * value must always go through the `decimal.js`-based money utilities
 * added in a later phase, never native `+`/`-`/`*`/`/`.
 */
export type MoneyAmount = string & { readonly __brand: 'MoneyAmount' };

/**
 * A monetary value paired with the currency it is denominated in. Every
 * amount in the system (invoice totals, payments, wallet balances, fees) is
 * represented this way so a value is never ambiguous about its currency.
 */
export interface Money {
  readonly amount: MoneyAmount;
  readonly currency: CurrencyCode;
}

/**
 * Fields present on every row of every tenant-scoped table. Every query
 * against a table that includes this shape must filter by `companyId` and
 * exclude soft-deleted rows (`deletedAt IS NULL`), per the project's
 * tenant-isolation rule.
 */
export interface TenantScopedEntity {
  readonly id: UUID;
  readonly companyId: UUID;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly deletedAt: ISODateString | null;
}

/**
 * Fields present on platform-level rows that are not scoped to a single
 * company (for example a subscription plan definition or a CMS page owned
 * by the super_admin).
 */
export interface PlatformEntity {
  readonly id: UUID;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly deletedAt: ISODateString | null;
}

/**
 * Standard ascending/descending sort direction used by every list query.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Pagination input accepted by every list-fetching Server Action or Route
 * Handler.
 */
export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortDirection?: SortDirection;
}

/**
 * Pagination metadata returned alongside a page of results.
 */
export interface PageResult<TItem> {
  readonly items: readonly TItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

/**
 * The exact return shape every Server Action must use, per the project's
 * Server Action convention: `'use server'` + Zod validation + try/catch,
 * returning either a success value or a user-facing error message. Never
 * throw an uncaught error from a Server Action; always resolve to this
 * shape instead.
 */
export type ActionResult<TData> =
  | { readonly success: true; readonly data: TData }
  | { readonly success: false; readonly error: string };

/**
 * Builds a successful {@link ActionResult}.
 *
 * @param data The value to return to the caller.
 * @returns A success-shaped action result.
 */
export function actionSuccess<TData>(data: TData): ActionResult<TData> {
  return { success: true, data };
}

/**
 * Builds a failed {@link ActionResult}.
 *
 * @param error A short, user-facing error message. Never leak raw
 * exception internals or stack traces here.
 * @returns A failure-shaped action result.
 */
export function actionFailure(error: string): ActionResult<never> {
  return { success: false, error };
}

/**
 * The four UI states every `'use client'` component must explicitly
 * render, per the project's component convention.
 */
export type AsyncUiState = 'loading' | 'error' | 'empty' | 'success';

/**
 * A postal address, used for company profiles, clients, and invoice
 * bill-to/ship-to snapshots.
 */
export interface Address {
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly country: CountryCode;
}
