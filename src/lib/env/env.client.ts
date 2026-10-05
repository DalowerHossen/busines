// src/lib/env/env.client.ts
// Public, browser-safe environment variables. Every value here is already
// exposed to the client bundle by Next.js, so only genuinely public
// configuration belongs in this file - never a secret key.
//
// Each `process.env.NEXT_PUBLIC_*` reference below must stay a literal
// property access (not a computed key or a loop over `process.env`),
// because Next.js replaces exactly that syntax at build time to inline the
// value into the client bundle. Reading through a dynamic key here would
// silently resolve to `undefined` in the browser.
import { z } from 'zod';

const optionalPublicString = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_SHORT_LINK_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_ASSET_BASE_URL: optionalPublicString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalPublicString,
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: optionalPublicString,
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: optionalPublicString,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalPublicString,
  NEXT_PUBLIC_SENTRY_DSN: optionalPublicString,
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: optionalPublicString,
  NEXT_PUBLIC_GTM_CONTAINER_ID: optionalPublicString,
  NEXT_PUBLIC_META_PIXEL_ID: optionalPublicString,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Formats every Zod validation issue into one readable, multi-line message.
 *
 * @param error The Zod error raised while parsing the public environment.
 * @returns A human readable summary of every invalid or missing variable.
 */
function formatValidationError(error: z.ZodError<ClientEnv>): string {
  const lines = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  return [
    'Invalid or missing public environment variables. Every NEXT_PUBLIC_*',
    'value must be set at build time:',
    ...lines,
  ].join('\n');
}

/**
 * Validates and returns the public environment, safe to import from both
 * Server and Client Components.
 *
 * @returns The validated, typed public environment.
 */
function loadClientEnv(): Readonly<ClientEnv> {
  const values = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SHORT_LINK_URL: process.env.NEXT_PUBLIC_SHORT_LINK_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ASSET_BASE_URL: process.env.NEXT_PUBLIC_ASSET_BASE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
    NEXT_PUBLIC_GTM_CONTAINER_ID: process.env.NEXT_PUBLIC_GTM_CONTAINER_ID,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  };

  const result = clientEnvSchema.safeParse(values);

  if (!result.success) {
    throw new Error(formatValidationError(result.error));
  }

  return Object.freeze(result.data);
}

export const clientEnv: Readonly<ClientEnv> = loadClientEnv();
