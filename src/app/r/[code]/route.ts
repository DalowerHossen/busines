// src/app/r/[code]/route.ts
// The public face of the referral programme. A visitor who follows a partner
// link lands here, the visit is counted, a random token is dropped on the
// browser, and the visitor carries on to the page they were promised. The
// referring page is never passed on, so a partner link cannot leak the
// address it came from.

import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { clientEnv } from '@/env/client';
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from '@/features/affiliates/services/attribution';
import { logger } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { contextFromRequest } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export interface ReferralRouteContext {
  /** Path parameters of the route. */
  params: { code: string };
}

/** Only these destinations may be reached through a referral link. */
const SAFE_DESTINATION = /^\/[A-Za-z0-9/_-]*$/;

/**
 * Sends a referred visitor on their way and counts the visit.
 *
 * @param request Incoming request.
 * @param context Route parameters carrying the referral code.
 * @returns A redirect to the destination page.
 */
export async function GET(
  request: NextRequest,
  context: ReferralRouteContext
): Promise<NextResponse> {
  const code = context.params.code.toLowerCase().slice(0, 40);
  const requested = request.nextUrl.searchParams.get('to') ?? '/';
  const destination = SAFE_DESTINATION.test(requested) ? requested : '/';
  const target = new URL(destination, clientEnv.NEXT_PUBLIC_APP_URL);

  const response = NextResponse.redirect(target, 302);

  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');

  const existing = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  const token = existing !== null && existing.length >= 8 ? existing : randomUUID();

  response.cookies.set({
    name: VISITOR_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: target.protocol === 'https:',
    path: '/',
    maxAge: VISITOR_COOKIE_MAX_AGE,
  });

  const requestContext = contextFromRequest(request);

  const decision = await consumeRateLimit({
    kind: 'referral_click',
    key: requestContext.ipHash ?? token,
    limit: 60,
    windowSeconds: 3600,
  });

  if (!decision.isAllowed) {
    return response;
  }

  const supabase = getServiceSupabaseClient();

  const { error } = await supabase.rpc('record_affiliate_click', {
    p_referral_code: code,
    p_visitor_token: token,
    p_landing_path: destination,
    p_referrer_url: null,
    p_ip_hash: requestContext.ipHash,
    p_user_agent: request.headers.get('user-agent'),
    p_utm_source: request.nextUrl.searchParams.get('utm_source'),
    p_utm_medium: request.nextUrl.searchParams.get('utm_medium'),
    p_utm_campaign: request.nextUrl.searchParams.get('utm_campaign'),
  });

  if (error) {
    logger.warn('A referral visit could not be recorded', { code });
  }

  return response;
}
