// next.config.mjs
// KD SOLUTION IT - Next.js configuration.
// Runtime behaviour is identical on Netlify, Vercel, Docker and any Node host.

/**
 * Builds the list of allowed remote image hosts.
 * Hosts are derived from environment variables so that changing a storage
 * provider never requires a code change.
 *
 * @returns {Array<{ protocol: 'https', hostname: string, pathname: string }>}
 */
function buildRemoteImagePatterns() {
  /** @type {string[]} */
  const candidates = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof supabaseUrl === 'string' && supabaseUrl.length > 0) {
    candidates.push(supabaseUrl);
  }

  const assetBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;
  if (typeof assetBaseUrl === 'string' && assetBaseUrl.length > 0) {
    candidates.push(assetBaseUrl);
  }

  /** @type {Array<{ protocol: 'https', hostname: string, pathname: string }>} */
  const patterns = [];
  const seen = new Set();

  for (const candidate of candidates) {
    try {
      const { hostname } = new URL(candidate);
      if (hostname.length > 0 && !seen.has(hostname)) {
        seen.add(hostname);
        patterns.push({ protocol: 'https', hostname, pathname: '/**' });
      }
    } catch {
      // An invalid URL is ignored here; environment validation reports it at runtime.
    }
  }

  return patterns;
}

/**
 * Baseline security headers applied to every response.
 * A nonce based Content Security Policy is added later in the security phase.
 *
 * @type {Array<{ key: string, value: string }>}
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,

  // Docker and bare VPS deployments build a self-contained server bundle so
  // the final image only needs `node server.js`, no `node_modules` copy.
  // Netlify and Vercel manage their own build output, so this only applies
  // when DOCKER_BUILD=true is set (see docker/Dockerfile).
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,

  eslint: {
    // Linting runs as a dedicated quality gate, so builds are not blocked twice.
    ignoreDuringBuilds: true,
    dirs: ['src', 'scripts'],
  },

  typescript: {
    // Type errors must always fail the build.
    ignoreBuildErrors: false,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 2592000,
    dangerouslyAllowSVG: false,
    remotePatterns: buildRemoteImagePatterns(),
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    optimizePackageImports: ['lucide-react', 'date-fns'],
    // Enables src/instrumentation.ts so required environment variables are
    // validated once at server startup instead of failing deep inside a
    // request handler. Stable without this flag starting in Next.js 15.
    instrumentationHook: true,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Tokenised client document links must never leak a referrer and must
        // never be indexed by search engines.
        source: '/i/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/pay/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default nextConfig;
