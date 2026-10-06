// src/lib/actions/create-action.ts
// The shape every server action shares: validate the input with Zod, run the
// work inside a try block, and answer with { success, data } or
// { success, error }. Nothing throws out of an action.

import 'server-only';

import type { z } from 'zod';

import { logger } from '@/lib/logger';
import { fail, failFrom, ok } from '@/lib/result';
import { toFieldErrors } from '@/lib/validation/primitives';
import type { ActionResult } from '@/types/common';

export interface ActionOptions {
  /** Short name used in the log line when the action fails unexpectedly. */
  name: string;
}

/**
 * Builds a server action from a schema and a handler.
 *
 * @param schema Schema the input must satisfy.
 * @param handler Work to perform once the input is known to be valid.
 * @param options Name used for logging.
 * @returns A function that never throws and always returns a result.
 */
export function createAction<Schema extends z.ZodTypeAny, Data>(
  schema: Schema,
  handler: (input: z.output<Schema>) => Promise<Data>,
  options: ActionOptions
): (input: unknown) => Promise<ActionResult<Data>> {
  return async (input: unknown): Promise<ActionResult<Data>> => {
    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      return fail<Data>('Please correct the highlighted fields.', toFieldErrors(parsed.error));
    }

    try {
      return ok(await handler(parsed.data));
    } catch (caught) {
      logger.error('A server action failed', caught, { action: options.name });
      return failFrom<Data>(caught);
    }
  };
}

/**
 * Builds a server action that takes no input.
 *
 * @param handler Work to perform.
 * @param options Name used for logging.
 * @returns A function that never throws and always returns a result.
 */
export function createSimpleAction<Data>(
  handler: () => Promise<Data>,
  options: ActionOptions
): () => Promise<ActionResult<Data>> {
  return async (): Promise<ActionResult<Data>> => {
    try {
      return ok(await handler());
    } catch (caught) {
      logger.error('A server action failed', caught, { action: options.name });
      return failFrom<Data>(caught);
    }
  };
}

/**
 * Reads the values of a submitted form into a plain object, so one schema can
 * validate both a form post and a direct call.
 *
 * @param formData Submitted form.
 * @returns The field names and their values.
 */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};

  for (const [key, value] of formData.entries()) {
    const text = typeof value === 'string' ? value : value.name;
    const existing = values[key];

    if (existing === undefined) {
      values[key] = text;
      continue;
    }

    values[key] = Array.isArray(existing) ? [...existing, text] : [existing, text];
  }

  return values;
}
