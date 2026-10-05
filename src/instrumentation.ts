// src/instrumentation.ts
// Next.js instrumentation hook (enabled via experimental.instrumentationHook
// in next.config.mjs). `register()` runs once per server runtime when the
// server starts, before any request is handled, which is exactly where
// fail-fast environment validation belongs: a misconfigured deployment
// crashes immediately with a readable error instead of failing on the
// first real request.
export async function register(): Promise<void> {
  // The encryption, signing, and Supabase secrets validated here are only
  // relevant to the Node.js server runtime, not the lightweight Edge
  // runtime used for middleware.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/env/env.server');
  }
}
