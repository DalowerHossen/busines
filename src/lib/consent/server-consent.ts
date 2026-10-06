// src/lib/consent/server-consent.ts
// Reading and writing the consent cookies on the server. The visitor token is
// anonymous and is created the first time somebody answers the banner, never
// before.

import 'server-only';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

type SyncCookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: Record<string, unknown>): void;
};

function syncCookieStore(): SyncCookieStore {
  return cookies() as unknown as SyncCookieStore;
}

import {
  CONSENT_COOKIE_NAME,
  CONSENT_MAX_AGE_SECONDS,
  VISITOR_COOKIE_NAME,
  decodeConsent,
  encodeConsent,
  type ConsentDecision,
} from '@/lib/consent/cookie-consent';

/**
 * Reads the decision stored in the request cookies.
 *
 * @returns The decision, or null when the visitor has not answered.
 */
export function readConsentDecision(): ConsentDecision | null {
  return decodeConsent(syncCookieStore().get(CONSENT_COOKIE_NAME)?.value ?? null);
}

/**
 * Reads the anonymous visitor identifier from the request cookies.
 *
 * @returns The token, or null when none has been issued.
 */
export function readVisitorToken(): string | null {
  const value = syncCookieStore().get(VISITOR_COOKIE_NAME)?.value ?? null;

  return value && value.length >= 16 && value.length <= 128 ? value : null;
}

/**
 * Creates an anonymous visitor identifier.
 *
 * @returns A new token in lowercase hexadecimal.
 */
export function createVisitorToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Stores the decision and the visitor identifier in cookies that survive the
 * browser being closed.
 *
 * @param decision Decision the visitor made.
 * @param visitorToken Identifier the decision is stored against.
 * @returns Nothing.
 */
export function writeConsentCookies(decision: ConsentDecision, visitorToken: string): void {
  const store = syncCookieStore();
  const isSecure = process.env.NODE_ENV === 'production';

  store.set(CONSENT_COOKIE_NAME, encodeConsent(decision), {
    httpOnly: false,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: CONSENT_MAX_AGE_SECONDS,
  });

  store.set(VISITOR_COOKIE_NAME, visitorToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: CONSENT_MAX_AGE_SECONDS,
  });
}
