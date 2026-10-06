// src/lib/auth/oauth.ts
// Signing in with Google or GitHub. The provider returns to a callback route
// that completes the exchange and sends the account to the right dashboard.

import { ROUTES } from '@/config/app';
import type { AuthProvider } from '@/types/enums';

export interface OAuthProviderDefinition {
  provider: Exclude<AuthProvider, 'email'>;
  label: string;
  /** Scopes requested in addition to the provider defaults. */
  scopes: string;
}

export const OAUTH_PROVIDERS: readonly OAuthProviderDefinition[] = [
  { provider: 'google', label: 'Continue with Google', scopes: 'email profile' },
  { provider: 'github', label: 'Continue with GitHub', scopes: 'read:user user:email' },
];

export const OAUTH_CALLBACK_PATH = '/auth/callback';

/**
 * Builds the address the provider returns to after a successful sign in.
 *
 * @param appUrl Public base address of the application.
 * @param nextPath Page to open once the exchange has finished.
 * @returns An absolute callback address.
 */
export function buildOAuthRedirectUrl(appUrl: string, nextPath: string = ROUTES.dashboard): string {
  const base = appUrl.replace(/\/+$/, '');
  const target = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;

  return `${base}${OAUTH_CALLBACK_PATH}?next=${encodeURIComponent(target)}`;
}

/**
 * Reports whether a value names a provider the platform supports.
 *
 * @param value Candidate provider name.
 * @returns True when the provider is offered.
 */
export function isSupportedOAuthProvider(value: unknown): value is Exclude<AuthProvider, 'email'> {
  return OAUTH_PROVIDERS.some((definition) => definition.provider === value);
}

/**
 * Keeps a redirect target inside the application, so an open redirect cannot
 * be smuggled through the sign in flow.
 *
 * @param nextPath Target asked for in the query string.
 * @returns A safe path to continue to.
 */
export function safeRedirectPath(nextPath: string | null | undefined): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return ROUTES.dashboard;
  }

  return nextPath;
}
