// src/lib/security/rate-limit.ts
// Request throttling backed by the database, so every instance of the
// application shares one counter. The counting routine is restricted to the
// service role, which is why the service client is used here.

import 'server-only';

import { RATE_LIMIT_DEFAULTS } from '@/config/app';
import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { asRow, readBoolean, readNumber, readString } from '@/lib/records';

export interface RateLimitDecision {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string | null;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  kind: string;
  key: string;
  limit?: number;
  windowSeconds?: number;
}

/**
 * Counts one request against a bucket and reports whether it may continue.
 *
 * A database failure never blocks a legitimate request: the call is allowed
 * and the failure is logged instead.
 *
 * @param options Which bucket to count against and how generous it is.
 * @returns The decision for this request.
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitDecision> {
  const limit = options.limit ?? RATE_LIMIT_DEFAULTS.maxRequests;
  const windowSeconds = options.windowSeconds ?? RATE_LIMIT_DEFAULTS.windowSeconds;

  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_bucket_kind: options.kind,
      p_bucket_key: options.key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? asRow(data[0]) : null;

    if (!row) {
      return { isAllowed: true, limit, remaining: limit, resetAt: null, retryAfterSeconds: 0 };
    }

    const resetAt = readString(row, 'reset_at');
    const resetMilliseconds = resetAt ? Date.parse(resetAt) - Date.now() : 0;

    return {
      isAllowed: readBoolean(row, 'is_allowed', true),
      limit: readNumber(row, 'limit_value') ?? limit,
      remaining: readNumber(row, 'remaining') ?? 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(resetMilliseconds / 1000)),
    };
  } catch (caught) {
    logger.error('The rate limit counter could not be reached', caught, {
      kind: options.kind,
    });

    return { isAllowed: true, limit, remaining: limit, resetAt: null, retryAfterSeconds: 0 };
  }
}

/**
 * Builds the bucket key for an anonymous caller.
 *
 * @param route Route being called.
 * @param ipHash Hashed address of the caller.
 * @returns The bucket key.
 */
export function anonymousBucketKey(route: string, ipHash: string | null): string {
  return `${route}:${ipHash ?? 'unknown'}`;
}

/**
 * Builds the bucket key for a signed in caller.
 *
 * @param route Route being called.
 * @param userId Account making the request.
 * @returns The bucket key.
 */
export function accountBucketKey(route: string, userId: string): string {
  return `${route}:user:${userId}`;
}

/**
 * Turns a decision into the headers an API client expects.
 *
 * @param decision Decision taken for this request.
 * @returns Headers describing the remaining allowance.
 */
export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    'RateLimit-Limit': String(decision.limit),
    'RateLimit-Remaining': String(Math.max(0, decision.remaining)),
    'RateLimit-Reset': String(decision.retryAfterSeconds),
  };
}
