// src/middleware.ts
// Runs before every page and API request: it turns away machines, refreshes
// the Supabase session, applies the security headers and keeps signed out
// visitors away from the areas that need an account.

import { type NextRequest, NextResponse } from 'next/server';

import { ROUTES } from '@/config/app';
import { judgePublicRequest, judgeSensitiveRequest } from '@/lib/security/bot-defence';
import { buildSecurityHeaders } from '@/lib/security/headers';
import { refreshSession } from '@/lib/supabase/middleware';

/** Areas that always need an account. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/reseller',
  '/accountant',
  '/affiliate',
  '/onboarding',
  '/settings',
];

/** Pages that a signed in account should not see again. */
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

/** Pages reached with a signed client link, which must never be indexed. */
const TOKENISED_PREFIXES = ['/d/', '/sign/', '/pay/'];

/**
 * Areas a machine has no business reading: signed client links, the money
 * pages behind them, and the console of the platform itself.
 */
const SENSITIVE_PREFIXES = [
  '/d/',
  '/sign/',
  '/pay/',
  '/dashboard',
  '/admin',
  '/reseller',
  '/accountant',
  '/affiliate',
  '/api/portal',
  '/api/files',
];

/**
 * Builds the refusal sent to a machine. It says nothing about what is
 * behind the address, because a refusal that explains itself is a hint.
 *
 * @returns The response to send instead of the page.
 */
function refuseMachine(): NextResponse {
  const response = new NextResponse('Not available.', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

  for (const [header, value] of Object.entries(buildSecurityHeaders({ isTokenisedPage: true }))) {
    response.headers.set(header, value);
  }

  return response;
}

/**
 * Reports whether a path starts with any of the given prefixes.
 *
 * @param pathname Path of the request.
 * @param prefixes Prefixes to test.
 * @returns True when one of them matches.
 */
function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

/**
 * Handles an incoming request before it reaches a page or a route.
 *
 * @param request Incoming request.
 * @returns The response to continue with.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const userAgent = request.headers.get('user-agent');

  // Judged before the session is even refreshed, so a crawler costs this
  // application one string comparison rather than a database round trip.
  const verdict = matchesPrefix(pathname, SENSITIVE_PREFIXES)
    ? judgeSensitiveRequest(userAgent)
    : judgePublicRequest(userAgent);

  if (verdict.isRefused) {
    return refuseMachine();
  }

  const { response, userId } = await refreshSession(request);

  const isTokenisedPage = matchesPrefix(pathname, TOKENISED_PREFIXES);

  for (const [header, value] of Object.entries(buildSecurityHeaders({ isTokenisedPage }))) {
    response.headers.set(header, value);
  }

  if (!userId && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = ROUTES.login;
    signIn.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;

    const redirect = NextResponse.redirect(signIn);

    for (const [header, value] of Object.entries(buildSecurityHeaders())) {
      redirect.headers.set(header, value);
    }

    return redirect;
  }

  if (userId && matchesPrefix(pathname, AUTH_PAGES)) {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = ROUTES.dashboard;
    dashboard.search = '';

    return NextResponse.redirect(dashboard);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the files Next.js serves itself.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2)$).*)',
  ],
};
