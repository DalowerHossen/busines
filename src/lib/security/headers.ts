// src/lib/security/headers.ts
// The response headers that protect every page. The referrer policy is the
// strictest available because a client document link carries its permission
// in the address, and must never travel to a third party site.

import { clientEnv } from '@/env/client';

/**
 * The hosts a measurement tool loads from. They are named here because a
 * policy that forbids them would quietly break every tag an administrator
 * switches on, and a silently broken tag is worse than no tag: somebody
 * makes decisions on the absence of data.
 *
 * Nothing loads from these hosts until the visitor has agreed to the
 * category it belongs to; the policy only decides what is permitted, not
 * what is requested.
 */
const MEASUREMENT_SCRIPT_HOSTS = [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://connect.facebook.net',
  'https://www.clarity.ms',
  'https://analytics.tiktok.com',
  'https://snap.licdn.com',
] as const;

const MEASUREMENT_CONNECT_HOSTS = [
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
  'https://www.googletagmanager.com',
  'https://graph.facebook.com',
  'https://analytics.tiktok.com',
  'https://px.ads.linkedin.com',
  'https://c.clarity.ms',
  'https://*.clarity.ms',
] as const;

const MEASUREMENT_IMAGE_HOSTS = [
  'https://www.google-analytics.com',
  'https://www.facebook.com',
  'https://px.ads.linkedin.com',
  'https://analytics.tiktok.com',
] as const;

export interface SecurityHeaderOptions {
  /** True for pages reached with a signed client link. */
  isTokenisedPage?: boolean;
  /** Extra sources allowed to be framed, such as a payment gateway. */
  frameSources?: readonly string[];
}

/**
 * Builds the content security policy.
 *
 * @param options How strict the page needs to be.
 * @returns The policy as a single header value.
 */
export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}): string {
  const supabaseOrigin = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  const assetOrigin = clientEnv.NEXT_PUBLIC_ASSET_BASE_URL;

  // A page reached with a client link carries a token in its address and is
  // never measured, so it is given the narrower policy.
  const isMeasured = options.isTokenisedPage !== true;

  const connectSources = [
    'self',
    supabaseOrigin,
    'https://api.stripe.com',
    ...(isMeasured ? MEASUREMENT_CONNECT_HOSTS : []),
  ];
  const imageSources = [
    'self',
    'data:',
    'blob:',
    supabaseOrigin,
    ...(isMeasured ? MEASUREMENT_IMAGE_HOSTS : []),
  ];
  const frameSources = ['self', 'https://js.stripe.com', ...(options.frameSources ?? [])];
  const scriptSources = [
    'self',
    "'unsafe-inline'",
    'https://js.stripe.com',
    'https://challenges.cloudflare.com',
    ...(isMeasured ? MEASUREMENT_SCRIPT_HOSTS : []),
  ];

  if (assetOrigin && assetOrigin.length > 0) {
    connectSources.push(assetOrigin);
    imageSources.push(assetOrigin);
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `img-src ${imageSources.map(quoteSource).join(' ')}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSources.map(quoteSource).join(' ')}`,
    `connect-src ${connectSources.map(quoteSource).join(' ')}`,
    `frame-src ${frameSources.map(quoteSource).join(' ')}`,
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
}

/**
 * Quotes the keywords a policy requires to be quoted.
 *
 * @param source Source expression.
 * @returns The source ready to place in a directive.
 */
function quoteSource(source: string): string {
  return source === 'self' || source === 'none' ? `'${source}'` : source;
}

/**
 * Builds the full set of security headers for a response.
 *
 * @param options How strict the page needs to be.
 * @returns Header names and values.
 */
export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildContentSecurityPolicy(options),
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-DNS-Prefetch-Control': 'off',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // Nothing on this platform is training material, and the invoices of a
    // client least of all. The header is read by the crawlers that honour it
    // and the robots file turns away the rest.
    'X-Robots-Tag': 'noai, noimageai',
  };

  if (options.isTokenisedPage) {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private';
    headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive, noai, noimageai, nosnippet';
  }

  return headers;
}

/** Attributes every outbound link must carry so a token cannot leak. */
export const SAFE_EXTERNAL_LINK_ATTRIBUTES = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const;
