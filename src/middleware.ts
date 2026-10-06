import { NextResponse, type NextRequest } from 'next/server';
import { refreshSupabaseSession } from '@/lib/supabase/middleware';
import { assessBotRequest, routeClassForPath } from '@/lib/security/bot-detection';
import { createSecurityHeaders, createSecurityNonce } from '@/lib/security/headers';
import type { SecurityRequestSnapshot } from '@/lib/security/types';

const AUTHENTICATED_PREFIXES = [
  '/dashboard',
  '/clients',
  '/invoices',
  '/estimates',
  '/payments',
  '/expenses',
  '/accounting',
  '/products',
  '/inventory',
  '/reports',
  '/settings',
  '/team',
  '/admin',
  '/reseller',
  '/affiliate',
  '/accountant',
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = createSecurityNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  const routeClass = routeClassForPath(request.nextUrl.pathname);
  const securityRequest: SecurityRequestSnapshot = {
    pathname: request.nextUrl.pathname,
    method: request.method,
    headers: headersToRecord(request.headers),
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  };
  const bot = assessBotRequest(securityRequest, routeClass);

  if (bot.action === 'block') {
    return withSecurityHeaders(
      NextResponse.json({ error: 'Request blocked.' }, { status: 403 }),
      nonce,
      routeClass
    );
  }

  const { response: sessionResponse, user } = await refreshSupabaseSession(request, requestHeaders);
  let response = sessionResponse;
  if (!user && isAuthenticatedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    response = copyResponseCookies(sessionResponse, NextResponse.redirect(loginUrl));
  }

  if (bot.action === 'challenge') response.headers.set('X-Security-Challenge', 'turnstile');
  return withSecurityHeaders(response, nonce, routeClass);
}

function withSecurityHeaders(
  response: NextResponse,
  nonce: string,
  routeClass: ReturnType<typeof routeClassForPath>
): NextResponse {
  const securityHeaders = createSecurityHeaders({
    nonce,
    isDevelopment: process.env.NODE_ENV !== 'production',
  });
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  if (routeClass === 'auth' || routeClass === 'sensitive') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  return response;
}

function copyResponseCookies(source: NextResponse, target: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

function isAuthenticatedPath(pathname: string): boolean {
  return AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function headersToRecord(headers: Headers): Readonly<Record<string, string | undefined>> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
