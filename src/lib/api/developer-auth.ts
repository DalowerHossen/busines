// src/lib/api/developer-auth.ts
// Turning a bearer token into a grant.
//
// Every public API route starts here. The token is checked by the database,
// which also records that the grant has been used, and the route is then
// told exactly which account it may read and what it is allowed to do.

import 'server-only';

import type { NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { asRow, readString, readStringArray } from '@/lib/records';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface DeveloperGrant {
  installId: string;
  appId: string;
  companyId: string;
  scopes: readonly string[];
  /** Requests this grant may still make in the current window. */
  remaining: number;
  /** Ceiling for the current window, for the response headers. */
  limit: number;
  /** When the window resets, for the response headers. */
  resetAt: string | null;
}

export type DeveloperAuthResult =
  | { kind: 'granted'; grant: DeveloperGrant }
  | { kind: 'unauthenticated'; message: string }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

/**
 * Reads the bearer token from a request.
 *
 * @param request Incoming request.
 * @returns The token, or null when none was sent.
 */
function readBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');

  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = header.slice(7).trim();

  return token.length > 0 ? token : null;
}

/**
 * Authenticates one API request made by an application.
 *
 * @param request Incoming request.
 * @returns The grant behind the token, or why the call is refused.
 */
export async function authenticateDeveloperRequest(
  request: NextRequest
): Promise<DeveloperAuthResult> {
  const token = readBearerToken(request);

  if (token === null) {
    return {
      kind: 'unauthenticated',
      message: 'Send your access token in the authorization header as a bearer token.',
    };
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('authenticate_developer_token', { p_token: token });

  if (error) {
    logger.error('An application token could not be checked', error);

    return { kind: 'unauthenticated', message: 'That access token could not be checked.' };
  }

  const row = Array.isArray(data) ? asRow(data[0]) : null;

  if (row === null) {
    return { kind: 'unauthenticated', message: 'That access token is not valid any more.' };
  }

  const installId = readString(row, 'install_id') ?? '';
  const decision = await consumeRateLimit({
    kind: 'developer_api',
    key: installId,
    limit: 120,
    windowSeconds: 60,
  });

  if (!decision.isAllowed) {
    return { kind: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds };
  }

  return {
    kind: 'granted',
    grant: {
      installId,
      appId: readString(row, 'app_id') ?? '',
      companyId: readString(row, 'company_id') ?? '',
      scopes: readStringArray(row, 'scopes'),
      remaining: decision.remaining,
      limit: decision.limit,
      resetAt: decision.resetAt,
    },
  };
}

/**
 * Checks whether a grant covers one permission.
 *
 * @param grant Grant behind the token.
 * @param scope Permission the route needs.
 * @returns True when the application may do it.
 */
export function grantAllows(grant: DeveloperGrant, scope: string): boolean {
  if (grant.scopes.includes(scope)) {
    return true;
  }

  const [resource] = scope.split(':');

  return resource !== undefined && grant.scopes.includes(`${resource}:*`);
}

/**
 * Builds the rate limit headers every API answer carries.
 *
 * @param grant Grant behind the token.
 * @returns Headers describing what is left of the allowance.
 */
export function rateLimitHeaders(grant: DeveloperGrant): Record<string, string> {
  return {
    'RateLimit-Limit': String(grant.limit),
    'RateLimit-Remaining': String(grant.remaining),
    ...(grant.resetAt === null ? {} : { 'RateLimit-Reset': grant.resetAt }),
  };
}
