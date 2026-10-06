// src/lib/security/login-abuse-supabase.ts
// Login abuse persistence must use the service-role repository boundary. The
// browser never receives access to security_rate_limit_buckets.
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { SecurityProviderError } from './errors';
import { loginAbuseKey, type LoginAbuseState, type LoginAbuseStore } from './login-abuse';

export function createSupabaseLoginAbuseStore(client: SupabaseClient): LoginAbuseStore {
  return {
    async get(key): Promise<LoginAbuseState> {
      const { data, error } = await client
        .from('security_rate_limit_buckets')
        .select('request_count,expires_at')
        .eq('bucket_key', key)
        .maybeSingle();
      if (error) throw unavailable();
      if (!data || typeof data.request_count !== 'number') {
        return { failureCount: 0, lockedUntil: null };
      }
      return {
        failureCount: Math.max(0, data.request_count),
        lockedUntil: typeof data.expires_at === 'string' ? data.expires_at : null,
      };
    },
    async recordFailure(input): Promise<LoginAbuseState> {
      const { data, error } = await client.rpc('consume_security_rate_limit', {
        p_bucket_key: input.key,
        p_limit: input.maxFailures,
        p_window_seconds: input.windowSeconds,
      });
      if (error) throw unavailable();
      const row = Array.isArray(data) ? data[0] : data;
      if (!isRateLimitRow(row)) throw unavailable();
      const failureCount = input.maxFailures - row.remaining;
      return {
        failureCount,
        lockedUntil: failureCount >= input.maxFailures ? row.reset_at : null,
      };
    },
    async clear(key): Promise<void> {
      const { error } = await client
        .from('security_rate_limit_buckets')
        .delete()
        .eq('bucket_key', key);
      if (error) throw unavailable();
    },
  };
}

export function loginAbuseStoreKey(input: {
  readonly identifier: string;
  readonly ipAddress?: string;
}): string {
  return loginAbuseKey(input);
}

function isRateLimitRow(
  value: unknown
): value is { readonly allowed: boolean; readonly remaining: number; readonly reset_at: string } {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.allowed === 'boolean' &&
    typeof row.remaining === 'number' &&
    Number.isInteger(row.remaining) &&
    row.remaining >= 0 &&
    typeof row.reset_at === 'string'
  );
}

function unavailable(): SecurityProviderError {
  return new SecurityProviderError(
    'supabase-login-abuse',
    'rate_limit_store_unavailable',
    503,
    true
  );
}
