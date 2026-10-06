// src/lib/records.ts
// Narrowing helpers that turn a raw database row into typed values. Nothing
// in the application reads a column without going through one of these, so a
// renamed column surfaces as a clear error instead of an undefined value.

import { AppError } from '@/lib/errors';
import type { DatabaseRow } from '@/types/database';
import { isJsonObject, type JsonObject } from '@/types/json';

/**
 * Accepts a value PostgREST returned and treats it as one row.
 *
 * The schema type describes rows with an index signature, so the client
 * cannot prove the shape of a hand written column list. This is the one place
 * the value is narrowed, and every reader below works from the result.
 *
 * @param value Value returned by the client.
 * @returns The row, or null when the value is not an object.
 */
export function asRow(value: unknown): DatabaseRow | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as DatabaseRow;
}

/**
 * Accepts a value PostgREST returned and treats it as a list of rows.
 *
 * @param value Value returned by the client.
 * @returns The rows, ignoring anything that is not an object.
 */
export function asRows(value: unknown): DatabaseRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((member) => asRow(member))
    .filter((member): member is DatabaseRow => member !== null);
}

/**
 * Reads a required string column.
 *
 * @param row Row returned by the database.
 * @param column Column name.
 * @returns The string value.
 */
export function requireString(row: DatabaseRow, column: string): string {
  const value = row[column];

  if (typeof value !== 'string') {
    throw new AppError('database_failure', `The column "${column}" did not return text.`);
  }

  return value;
}

/**
 * Reads an optional string column.
 *
 * @param row Row returned by the database.
 * @param column Column name.
 * @returns The string value, or null when it is absent.
 */
export function readString(row: DatabaseRow, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' ? value : null;
}

/**
 * Reads a numeric column, accepting the string form PostgREST uses for the
 * numeric type so no precision is lost on the way.
 *
 * @param row Row returned by the database.
 * @param column Column name.
 * @returns The number, or null when it is absent or unreadable.
 */
export function readNumber(row: DatabaseRow, column: string): number | null {
  const value = row[column];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Reads a money column without converting it, keeping full precision.
 *
 * @param row Row returned by the database.
 * @param column Column name.
 * @param fallback Value used when the column is absent.
 * @returns The amount as a string.
 */
export function readAmount(row: DatabaseRow, column: string, fallback = '0'): string {
  const value = row[column];

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

/**
 * Reads a boolean column.
 *
 * @param row Row returned by the database.
 * @param column Column name.
 * @param fallback Value used when the column is absent.
 * @returns The boolean value.
 */
export function readBoolean(row: DatabaseRow, column: string, fallback = false): boolean {
  const value = row[column];
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Reads a column that holds one of a known set of values.
 *
 * @param row Row returned by the database.
 * @param column Column name.
 * @param allowed The values the column may hold.
 * @param fallback Value used when the column holds something else.
 * @returns One of the allowed values.
 */
export function readEnum<Value extends string>(
  row: DatabaseRow,
  column: string,
  allowed: readonly Value[],
  fallback: Value
): Value {
  const value = row[column];

  if (typeof value === 'string' && allowed.includes(value as Value)) {
    return value as Value;
  }

  return fallback;
}

/**
 * Reads a jsonb column.
 *
 * @param row Row returned by the database.
 * @param column Column name.
 * @returns The object, or an empty object when the column is absent.
 */
export function readJson(row: DatabaseRow, column: string): JsonObject {
  const value = row[column];
  return isJsonObject(value) ? value : {};
}

/**
 * Reads a text array column.
 *
 * @param row Row returned by the database.
 * @param column Column name.
 * @returns The strings in the array, ignoring any other members.
 */
export function readStringArray(row: DatabaseRow, column: string): string[] {
  const value = row[column];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((member): member is string => typeof member === 'string');
}

/**
 * Reads a row that the caller expects to exist.
 *
 * @param rows Rows returned by the database.
 * @param subject What was being looked for, used in the error message.
 * @returns The first row.
 */
export function requireRow(rows: DatabaseRow[] | null, subject: string): DatabaseRow {
  const first = rows?.[0];

  if (!first) {
    throw new AppError('not_found', `${subject} was not found.`);
  }

  return first;
}
