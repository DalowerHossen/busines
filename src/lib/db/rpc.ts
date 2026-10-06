// src/lib/db/rpc.ts
// Calling database routines. Business rules live in the database, so most
// writes go through a routine rather than a direct table statement. A failure
// is translated into an application error with a message worth reading.

import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { DatabaseRow } from '@/types/database';
import type { Json } from '@/types/json';

export type RpcArguments = Record<string, Json>;

export interface RpcClient {
  rpc(
    name: string,
    args?: RpcArguments
  ): PromiseLike<{ data: unknown; error: PostgrestError | null }>;
}

/** Database error codes that mean the caller was refused, not that we broke. */
const REFUSAL_CODES = new Set(['42501', 'P0001', '23505', '23514', '22023', 'P0002']);

/**
 * Turns a database error into the error the application reports.
 *
 * @param routine Routine that was called.
 * @param error Error returned by the database.
 * @returns The error to throw.
 */
function toAppError(routine: string, error: PostgrestError): AppError {
  const message = error.message.trim();

  if (error.code === '42501') {
    return new AppError('forbidden', message || 'You do not have access to this.');
  }

  if (error.code === 'P0002') {
    return new AppError('not_found', message || 'That record was not found.');
  }

  if (error.code === '23505') {
    return new AppError('conflict', message || 'That record already exists.');
  }

  if (error.code && REFUSAL_CODES.has(error.code)) {
    return new AppError('validation_failed', message);
  }

  logger.error('A database routine failed', error, { routine });

  return new AppError('database_failure', 'The request could not be completed.');
}

/**
 * Calls a routine and returns whatever it produced.
 *
 * @param client Supabase client to call through.
 * @param routine Name of the routine.
 * @param args Named arguments for the routine.
 * @returns The value the routine returned.
 */
export async function callRoutine(
  client: RpcClient,
  routine: string,
  args: RpcArguments = {}
): Promise<unknown> {
  const { data, error } = await client.rpc(routine, args);

  if (error) {
    throw toAppError(routine, error);
  }

  return data;
}

/**
 * Calls a routine that returns a single identifier.
 *
 * @param client Supabase client to call through.
 * @param routine Name of the routine.
 * @param args Named arguments for the routine.
 * @returns The identifier.
 */
export async function callRoutineForId(
  client: RpcClient,
  routine: string,
  args: RpcArguments = {}
): Promise<string> {
  const value = await callRoutine(client, routine, args);

  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError('database_failure', 'The request did not return a record.');
  }

  return value;
}

/**
 * Calls a routine that answers yes or no.
 *
 * @param client Supabase client to call through.
 * @param routine Name of the routine.
 * @param args Named arguments for the routine.
 * @returns The answer, treating anything unreadable as false.
 */
export async function callRoutineForBoolean(
  client: RpcClient,
  routine: string,
  args: RpcArguments = {}
): Promise<boolean> {
  return (await callRoutine(client, routine, args)) === true;
}

/**
 * Calls a routine that returns a set of rows.
 *
 * @param client Supabase client to call through.
 * @param routine Name of the routine.
 * @param args Named arguments for the routine.
 * @returns The rows, or an empty list when there were none.
 */
export async function callRoutineForRows(
  client: RpcClient,
  routine: string,
  args: RpcArguments = {}
): Promise<DatabaseRow[]> {
  const value = await callRoutine(client, routine, args);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (row): row is DatabaseRow => typeof row === 'object' && row !== null && !Array.isArray(row)
  );
}

/**
 * Calls a routine that returns at most one row.
 *
 * @param client Supabase client to call through.
 * @param routine Name of the routine.
 * @param args Named arguments for the routine.
 * @returns The row, or null when the routine returned nothing.
 */
export async function callRoutineForRow(
  client: RpcClient,
  routine: string,
  args: RpcArguments = {}
): Promise<DatabaseRow | null> {
  const rows = await callRoutineForRows(client, routine, args);
  return rows[0] ?? null;
}
