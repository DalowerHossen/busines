// src/lib/api/create-route.ts
// The shape every API route shares: read the body, validate it, check who is
// calling, apply a rate limit and answer with the right status code.

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

import { requireUser } from '@/lib/auth/guards';
import type { SessionUser } from '@/lib/auth/types';
import { AppError } from '@/lib/errors';
import { errorResponse, errorResponseFrom, HTTP_STATUS, jsonResponse } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import {
  accountBucketKey,
  anonymousBucketKey,
  consumeRateLimit,
  rateLimitHeaders,
} from '@/lib/security/rate-limit';
import { contextFromRequest } from '@/lib/security/request-context';
import { toFieldErrors } from '@/lib/validation/primitives';
import type { Json } from '@/types/json';

export interface RouteContext<Input> {
  request: NextRequest;
  input: Input;
  user: SessionUser | null;
}

export interface RouteOptions<Schema extends z.ZodTypeAny> {
  /** Name used for logging and for the rate limit bucket. */
  name: string;
  /** Schema the request body or query must satisfy. */
  schema?: Schema;
  /** True when the caller must be signed in. */
  requireAuth?: boolean;
  /** Requests allowed in one window for a single caller. */
  rateLimit?: number;
  /** Length of the rate limit window. */
  rateLimitWindowSeconds?: number;
  /** Status code used for a successful answer. */
  successStatus?: number;
}

/**
 * Reads the input of a request, from the body for writes and from the query
 * string for reads.
 *
 * @param request Incoming request.
 * @returns The input as a plain object.
 */
async function readInput(request: NextRequest): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'DELETE') {
    return Object.fromEntries(request.nextUrl.searchParams.entries());
  }

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      throw new AppError('validation_failed', 'The request body is not valid JSON.');
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  return {};
}

/**
 * Builds a route handler with validation, authentication and throttling.
 *
 * @param options How the route behaves.
 * @param handler Work to perform once the request is known to be acceptable.
 * @returns A handler ready to export from a route file.
 */
export function createRoute<Schema extends z.ZodTypeAny, Body extends Json>(
  options: RouteOptions<Schema>,
  handler: (context: RouteContext<z.output<Schema>>) => Promise<Body | NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const user = options.requireAuth ? await requireUser() : null;

      if (options.rateLimit) {
        const context = contextFromRequest(request);
        const key = user
          ? accountBucketKey(options.name, user.id)
          : anonymousBucketKey(options.name, context.ipHash);

        const decision = await consumeRateLimit({
          kind: 'api_route',
          key,
          limit: options.rateLimit,
          windowSeconds: options.rateLimitWindowSeconds,
        });

        if (!decision.isAllowed) {
          const response = errorResponse(
            'Too many requests. Please slow down and try again shortly.',
            HTTP_STATUS.tooManyRequests,
            'rate_limited'
          );

          for (const [header, value] of Object.entries(rateLimitHeaders(decision))) {
            response.headers.set(header, value);
          }

          response.headers.set('Retry-After', String(decision.retryAfterSeconds));

          return response;
        }
      }

      const rawInput = await readInput(request);
      let input = rawInput as z.output<Schema>;

      if (options.schema) {
        const parsed = options.schema.safeParse(rawInput);

        if (!parsed.success) {
          return errorResponse(
            'The request could not be accepted.',
            HTTP_STATUS.unprocessable,
            'validation_failed',
            toFieldErrors(parsed.error)
          );
        }

        input = parsed.data;
      }

      const result = await handler({ request, input, user });

      if (result instanceof Response) {
        return result as NextResponse;
      }

      return jsonResponse(result, options.successStatus ?? HTTP_STATUS.ok);
    } catch (caught) {
      logger.error('An API route failed', caught, { route: options.name });
      return errorResponseFrom(caught);
    }
  };
}
