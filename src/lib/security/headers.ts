const DEFAULT_CONNECT_SOURCES = [
  "'self'",
  'https://*.supabase.co',
  'wss://*.supabase.co',
  'https://challenges.cloudflare.com',
];

export function createSecurityNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function createContentSecurityPolicy(input: {
  readonly nonce: string;
  readonly connectSources?: readonly string[];
  readonly isDevelopment?: boolean;
}): string {
  if (!input.nonce || /[^A-Za-z0-9+/=]/u.test(input.nonce)) {
    throw new Error('A valid security nonce is required.');
  }
  const connectSources = input.connectSources ?? DEFAULT_CONNECT_SOURCES;
  const developmentSources = input.isDevelopment
    ? ['http://localhost:3000', 'ws://localhost:3000']
    : [];
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${input.nonce}' 'strict-dynamic' https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${[...connectSources, ...developmentSources].join(' ')}`,
    'frame-src https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(input.isDevelopment ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}

export function createSecurityHeaders(input: {
  readonly nonce: string;
  readonly isDevelopment?: boolean;
}): Record<string, string> {
  return {
    'Content-Security-Policy': createContentSecurityPolicy(input),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-DNS-Prefetch-Control': 'on',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Origin-Agent-Cluster': '?1',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  };
}
