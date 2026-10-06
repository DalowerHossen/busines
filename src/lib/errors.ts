// src/lib/errors.ts
// A single error vocabulary for server actions, API routes and background jobs.

export const ERROR_CODES = [
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'payment_required',
  'entitlement_exceeded',
  'integration_failure',
  'database_failure',
  'unexpected',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  validation_failed: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  payment_required: 402,
  entitlement_exceeded: 403,
  integration_failure: 502,
  database_failure: 500,
  unexpected: 500,
};

/** An error the application raised on purpose and knows how to report. */
export class AppError extends Error {
  public readonly code: ErrorCode;

  public readonly status: number;

  public readonly fieldErrors: Record<string, string[]> | undefined;

  public override readonly cause: unknown;

  public constructor(
    code: ErrorCode,
    message: string,
    options?: { fieldErrors?: Record<string, string[]>; cause?: unknown }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fieldErrors = options?.fieldErrors;
    this.cause = options?.cause;
  }
}

/**
 * Builds an error for input that failed validation.
 *
 * @param message Message shown to the person who submitted the form.
 * @param fieldErrors Messages grouped by form field name.
 * @returns The error to throw.
 */
export function validationError(message: string, fieldErrors?: Record<string, string[]>): AppError {
  return new AppError('validation_failed', message, { fieldErrors });
}

/**
 * Builds the error raised when nobody is signed in.
 *
 * @param message Message shown to the visitor.
 * @returns The error to throw.
 */
export function unauthenticatedError(message = 'Please sign in to continue.'): AppError {
  return new AppError('unauthenticated', message);
}

/**
 * Builds the error raised when the signed in account lacks permission.
 *
 * @param message Message shown to the user.
 * @returns The error to throw.
 */
export function forbiddenError(message = 'You do not have access to this.'): AppError {
  return new AppError('forbidden', message);
}

/**
 * Builds the error raised when a record does not exist or is not visible.
 *
 * @param subject What was being looked for, such as "Invoice".
 * @returns The error to throw.
 */
export function notFoundError(subject = 'Record'): AppError {
  return new AppError('not_found', `${subject} was not found.`);
}

/**
 * Builds the error raised when a request conflicts with the current state.
 *
 * @param message Message explaining the conflict.
 * @returns The error to throw.
 */
export function conflictError(message: string): AppError {
  return new AppError('conflict', message);
}

/**
 * Reports whether an unknown value is an application error.
 *
 * @param value Value caught in a try block.
 * @returns True when the value is an AppError.
 */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Turns anything that was thrown into a message safe to show a user.
 *
 * @param value Value caught in a try block.
 * @param fallback Message used when nothing better can be derived.
 * @returns A human readable message.
 */
export function toUserMessage(
  value: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (isAppError(value)) {
    return value.message;
  }

  if (value instanceof Error && value.message.trim().length > 0) {
    return value.message;
  }

  return fallback;
}

/**
 * Maps anything that was thrown onto an HTTP status code.
 *
 * @param value Value caught in a try block.
 * @returns The status code to answer with.
 */
export function toHttpStatus(value: unknown): number {
  return isAppError(value) ? value.status : 500;
}
