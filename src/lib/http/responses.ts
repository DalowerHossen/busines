// src/lib/http/responses.ts
// Consistent JSON responses for every API route, including the headers that
// keep tokenised client links from leaking through the referrer.

import { NextResponse } from 'next/server';

import { isAppError, toHttpStatus, toUserMessage } from '@/lib/errors';
import type { Json } from '@/types/json';

export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  accepted: 202,
  noContent: 204,
  temporaryRedirect: 307,
  badRequest: 400,
  unauthorised: 401,
  paymentRequired: 402,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  tooManyRequests: 429,
  serverError: 500,
  badGateway: 502,
} as const;

export interface ApiErrorBody {
  error: string;
  code: string;
  fieldErrors?: Record<string, string[]>;
}

const SAFE_HEADERS: Readonly<Record<string, string>> = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

/**
 * Answers with a JSON payload and the standard safety headers.
 *
 * @param body Payload to serialise.
 * @param status HTTP status code.
 * @returns The response to return from the route handler.
 */
export function jsonResponse<Body extends Json>(
  body: Body,
  status: number = HTTP_STATUS.ok
): NextResponse {
  return NextResponse.json(body, { status, headers: SAFE_HEADERS });
}

/**
 * Answers with a created resource.
 *
 * @param body Payload describing the new resource.
 * @returns The response to return from the route handler.
 */
export function createdResponse<Body extends Json>(body: Body): NextResponse {
  return jsonResponse(body, HTTP_STATUS.created);
}

/**
 * Answers with no content at all.
 *
 * @returns The response to return from the route handler.
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: HTTP_STATUS.noContent, headers: SAFE_HEADERS });
}

/**
 * Answers with an error body.
 *
 * @param message Message safe to show the caller.
 * @param status HTTP status code.
 * @param code Machine readable error code.
 * @param fieldErrors Messages grouped by field name.
 * @returns The response to return from the route handler.
 */
export function errorResponse(
  message: string,
  status: number,
  code = 'request_failed',
  fieldErrors?: Record<string, string[]>
): NextResponse {
  const body: ApiErrorBody = fieldErrors
    ? { error: message, code, fieldErrors }
    : { error: message, code };
  return NextResponse.json(body, { status, headers: SAFE_HEADERS });
}

/**
 * Turns anything that was thrown into the right error response.
 *
 * @param caught Value caught in a try block.
 * @returns The response to return from the route handler.
 */
export function errorResponseFrom(caught: unknown): NextResponse {
  if (isAppError(caught)) {
    return errorResponse(caught.message, caught.status, caught.code, caught.fieldErrors);
  }

  return errorResponse(toUserMessage(caught), toHttpStatus(caught), 'unexpected');
}

/**
 * Answers a rate limited caller, telling them when to try again.
 *
 * @param retryAfterSeconds Seconds the caller should wait.
 * @param limit Requests allowed in the window.
 * @param remaining Requests still available.
 * @returns The response to return from the route handler.
 */
export function rateLimitedResponse(
  retryAfterSeconds: number,
  limit: number,
  remaining = 0
): NextResponse {
  const body: ApiErrorBody = {
    error: 'Too many requests. Please slow down and try again shortly.',
    code: 'rate_limited',
  };

  return NextResponse.json(body, {
    status: HTTP_STATUS.tooManyRequests,
    headers: {
      ...SAFE_HEADERS,
      'Retry-After': String(retryAfterSeconds),
      'RateLimit-Limit': String(limit),
      'RateLimit-Remaining': String(remaining),
      'RateLimit-Reset': String(retryAfterSeconds),
    },
  });
}
