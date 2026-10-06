import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SecurityProviderError, securityInvalidConfiguration } from './errors';
import type { RateLimitKeyInput, RateLimitPolicy, RateLimitResult, RateLimitStore } from './types';

export function buildRateLimitKey(input: RateLimitKeyInput): string {
  const canonical = [
    input.pathname.trim().toLowerCase(),
    input.method.trim().toUpperCase(),
    normalizeIdentifier(input.ipAddress),
    normalizeIdentifier(input.accountIdentifier),
    normalizeUserAgent(input.userAgent),
    normalizeIdentifier(input.requestFingerprint),
  ].join('|');
  return `security:v1:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

export function validateRateLimitPolicy(policy: RateLimitPolicy): void {
  if (
    !policy.name ||
    !Number.isSafeInteger(policy.limit) ||
    policy.limit < 1 ||
    !Number.isSafeInteger(policy.windowSeconds) ||
    policy.windowSeconds < 1
  ) {
    throw securityInvalidConfiguration();
  }
}

export async function enforceRateLimit(input: {
  readonly store: RateLimitStore;
  readonly key: RateLimitKeyInput;
  readonly policy: RateLimitPolicy;
}): Promise<RateLimitResult> {
  validateRateLimitPolicy(input.policy);
  const bucketKey = buildRateLimitKey(input.key);
  try {
    return await input.store.consume({
      bucketKey,
      limit: input.policy.limit,
      windowSeconds: input.policy.windowSeconds,
    });
  } catch (error) {
    if (error instanceof SecurityProviderError) throw error;
    throw new SecurityProviderError('rate-limit-store', 'rate_limit_store_unavailable', 503, true);
  }
}

export function createSupabaseRateLimitStore(client: SupabaseClient): RateLimitStore {
  return {
    async consume(input): Promise<RateLimitResult> {
      const { data, error } = await client.rpc('consume_security_rate_limit', {
        p_bucket_key: input.bucketKey,
        p_limit: input.limit,
        p_window_seconds: input.windowSeconds,
      });
      if (error) {
        throw new SecurityProviderError(
          'supabase-rate-limit',
          'rate_limit_store_unavailable',
          503,
          true
        );
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!isRateLimitRow(row)) {
        throw new SecurityProviderError(
          'supabase-rate-limit',
          'invalid_provider_response',
          null,
          false
        );
      }
      return {
        allowed: row.allowed,
        remaining: row.remaining,
        resetAt: row.reset_at,
      };
    },
  };
}

function isRateLimitRow(
  value: unknown
): value is { readonly allowed: boolean; readonly remaining: number; readonly reset_at: string } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.allowed === 'boolean' &&
    typeof record.remaining === 'number' &&
    Number.isInteger(record.remaining) &&
    record.remaining >= 0 &&
    typeof record.reset_at === 'string'
  );
}

function normalizeIdentifier(value: string | undefined): string {
  return (value ?? 'unknown').trim().slice(0, 256).toLowerCase();
}

function normalizeUserAgent(value: string | undefined): string {
  return normalizeIdentifier(value).replace(/\s+/gu, ' ').slice(0, 200);
}
