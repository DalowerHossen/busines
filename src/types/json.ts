// src/types/json.ts
// The JSON shape accepted and returned by PostgreSQL jsonb columns.

export type JsonPrimitive = string | number | boolean | null;

export type Json = JsonPrimitive | Json[] | { [key: string]: Json | undefined };

export type JsonObject = { [key: string]: Json | undefined };

/**
 * Narrows an unknown value to a JSON object.
 *
 * @param value Value of unknown shape, usually parsed from a database column.
 * @returns True when the value is a plain object usable as a JSON record.
 */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a string property from a JSON object without throwing.
 *
 * @param value Candidate JSON object.
 * @param key Property name to read.
 * @returns The string value, or null when it is missing or not a string.
 */
export function readJsonString(value: unknown, key: string): string | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const property = value[key];
  return typeof property === 'string' ? property : null;
}

/**
 * Reads a number property from a JSON object without throwing.
 *
 * @param value Candidate JSON object.
 * @param key Property name to read.
 * @returns The number value, or null when it is missing or not a number.
 */
export function readJsonNumber(value: unknown, key: string): number | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const property = value[key];
  return typeof property === 'number' && Number.isFinite(property) ? property : null;
}
