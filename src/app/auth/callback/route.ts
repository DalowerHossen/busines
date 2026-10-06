// src/app/auth/callback/route.ts
// Where a provider, a confirmation link or a magic link returns to. The code
// in the query string is exchanged for a session, the account is prepared if
// this is its first sign in, and the browser continues to the page it wanted.

import { type NextRequest, NextResponse } from 'next/server';

import { ROUTES } from '@/config/app';
import { provisionAccount } from '@/features/auth/services/provision-account';
import { recordLoginAttempt } from '@/features/auth/services/login-attempts';
import { isSupportedOAuthProvider, safeRedirectPath } from '@/lib/auth/oauth';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Reads a readable name out of whatever the provider supplied.
 *
 * @param metadata Values the provider returned with the account.
 * @param email Address of the account, used as a last resort.
 * @returns A name to show in the interface.
 */
function readFullName(metadata: Record<string, unknown>, email: string): string {
  const candidates = [metadata['full_name'], metadata['name'], metadata['user_name']];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length >= 2) {
      return candidate.trim().slice(0, 120);
    }
  }

  return email.split('@')[0] ?? 'Account owner';
}

/**
 * Handles the return from an authentication provider.
 *
 * @param request Incoming request carrying the authorisation code.
 * @returns A redirect to the next page, or to the sign in page on failure.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextPath = safeRedirectPath(searchParams.get('next'));
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');

  if (providerError) {
    logger.warn('A provider refused a sign in', { reason: providerError });

    return NextResponse.redirect(`${origin}${ROUTES.login}?error=provider`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}${ROUTES.login}?error=missing_code`);
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    logger.error('An authorisation code could not be exchanged', error, {
      action: 'authCallback',
    });

    return NextResponse.redirect(`${origin}${ROUTES.login}?error=exchange_failed`);
  }

  const email = data.user.email ?? '';
  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = readFullName(metadata, email);
  const companyNameValue = metadata['company_name'];
  const companyName =
    typeof companyNameValue === 'string' && companyNameValue.trim().length >= 2
      ? companyNameValue.trim()
      : `${fullName} Business`;

  try {
    await provisionAccount({
      authUserId: data.user.id,
      email,
      fullName,
      companyName,
      isEmailVerified: Boolean(data.user.email_confirmed_at),
    });
  } catch (caught) {
    logger.error('An account could not be prepared after a provider sign in', caught, {
      action: 'authCallback',
    });

    return NextResponse.redirect(`${origin}${ROUTES.login}?error=provisioning_failed`);
  }

  const providerName = data.user.app_metadata['provider'];

  await recordLoginAttempt({
    email,
    succeeded: true,
    userId: data.user.id,
    provider: isSupportedOAuthProvider(providerName) ? providerName : 'email',
  });

  return NextResponse.redirect(`${origin}${nextPath}`);
}
