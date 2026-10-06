// src/lib/result.ts
// Helpers for the { success, data, error } contract every server action returns.

import { isAppError, toUserMessage } from '@/lib/errors';
import type { ActionResult } from '@/types/common';

/**
 * Wraps a value as a successful action result.
 *
 * @param data Payload handed back to the caller.
 * @returns A successful result.
 */
export function ok<Data>(data: Data): ActionResult<Data> {
  return { success: true, data };
}

/**
 * Wraps nothing as a successful action result.
 *
 * @returns A successful result with no payload.
 */
export function okEmpty(): ActionResult<undefined> {
  return { success: true, data: undefined };
}

/**
 * Builds a failed action result.
 *
 * @param error Message shown to the user.
 * @param fieldErrors Messages grouped by form field name.
 * @returns A failed result.
 */
export function fail<Data = undefined>(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<Data> {
  return fieldErrors ? { success: false, error, fieldErrors } : { success: false, error };
}

/**
 * Turns a caught value into a failed action result.
 *
 * @param caught Value caught in a try block.
 * @param fallback Message used when the value carries none.
 * @returns A failed result.
 */
export function failFrom<Data = undefined>(
  caught: unknown,
  fallback = 'Something went wrong. Please try again.'
): ActionResult<Data> {
  if (isAppError(caught) && caught.fieldErrors) {
    return { success: false, error: caught.message, fieldErrors: caught.fieldErrors };
  }

  return { success: false, error: toUserMessage(caught, fallback) };
}

/**
 * Narrows a result to its successful form.
 *
 * @param result Result to inspect.
 * @returns True when the action succeeded.
 */
export function isOk<Data>(result: ActionResult<Data>): result is { success: true; data: Data } {
  return result.success;
}

/**
 * Reads the payload of a successful result, or a fallback when it failed.
 *
 * @param result Result to read.
 * @param fallback Value returned when the action failed.
 * @returns The payload or the fallback.
 */
export function unwrapOr<Data>(result: ActionResult<Data>, fallback: Data): Data {
  return result.success ? result.data : fallback;
}
