// src/lib/security/csrf.ts
// Cross site request forgery protection for the routes that cannot rely on
// the same site cookie alone, such as form posts from an embedded payment
// page. A token is random, signed and short lived.

import 'server-only';

import { randomBytes } from 'node:crypto';

import { serverEnv } from '@/env/server';
import { hmacBase64Url, signaturesMatch } from '@/lib/crypto/hashing';

export const CSRF_COOKIE_NAME = 'kd_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const TOKEN_LIFETIME_MINUTES = 120;

/**
 * Issues a signed token to place in a cookie and in a hidden form field.
 *
 * @returns The token.
 */
export function issueCsrfToken(): string {
  const nonce = randomBytes(18).toString('base64url');
  const expiresAt = Date.now() + TOKEN_LIFETIME_MINUTES * 60 * 1000;
  const body = `${nonce}.${expiresAt}`;

  return `${body}.${hmacBase64Url(body, serverEnv.CSRF_SECRET)}`;
}

/**
 * Checks that a token is well formed, unexpired and correctly signed.
 *
 * @param token Token submitted with the request.
 * @returns True when the token may be trusted.
 */
export function isCsrfTokenValid(token: string | null | undefined): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    return false;
  }

  const [nonce, expiresAt, signature] = parts;

  if (!nonce || !expiresAt || !signature) {
    return false;
  }

  const expiry = Number.parseInt(expiresAt, 10);

  if (!Number.isFinite(expiry) || expiry < Date.now()) {
    return false;
  }

  const expected = hmacBase64Url(`${nonce}.${expiresAt}`, serverEnv.CSRF_SECRET);

  return signaturesMatch(signature, expected);
}

/**
 * Checks the token a request carries against the one in its cookie.
 *
 * @param headerToken Token sent in the request header or form body.
 * @param cookieToken Token held in the cookie.
 * @returns True when both are valid and identical.
 */
export function doubleSubmitMatches(
  headerToken: string | null | undefined,
  cookieToken: string | null | undefined
): boolean {
  if (!headerToken || !cookieToken) {
    return false;
  }

  return isCsrfTokenValid(headerToken) && signaturesMatch(headerToken, cookieToken);
}

/** Cookie settings used whenever the token is written. */
export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: 'lax',
  secure: true,
  path: '/',
  maxAge: TOKEN_LIFETIME_MINUTES * 60,
} as const;
