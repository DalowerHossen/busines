// src/lib/env/env.server.ts
// Server-only environment variable schema and fail-fast boot validation.
// Every server module (Server Components, Server Actions, Route Handlers,
// background jobs) must read configuration through `serverEnv` exported
// here instead of touching `process.env` directly, so a missing or
// malformed value is caught immediately with a clear error instead of
// failing deep inside a payment or storage call.
//
// Only SECTION 1, 2 and 3 fields (application, Supabase, and the
// encryption/signing secrets) are required to boot. Every integration
// credential below that is optional here because its real, current value
// is read from the database at request time (see
// docs/planning/ARCHITECTURE-DECISIONS.md "DB value -> env var -> default"
// resolution order); the environment variable only serves as the
// platform-wide fallback when no database value has been configured yet.
import 'server-only';
import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const serverEnvSchema = z.object({
  // Section 1 - application (required).
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_SHORT_LINK_URL: z.string().url(),
  APP_ENV: z.enum(['development', 'test', 'production']),

  // Section 2 - Supabase (required - application bootstrap).
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: optionalString,

  // Section 3 - encryption and signing secrets (required - never rotate).
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters.'),
  LINK_SIGNING_SECRET: z.string().min(32, 'LINK_SIGNING_SECRET must be at least 32 characters.'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters.'),
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters.'),

  // Section 4 - email (optional fallback).
  RESEND_API_KEY: optionalString,
  EMAIL_FROM_ADDRESS: optionalString,
  EMAIL_FROM_NAME: optionalString,
  EMAIL_REPLY_TO: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalString,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,

  // Section 5 - payment gateways (optional fallback).
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  PAYPAL_CLIENT_SECRET: optionalString,
  PAYPAL_WEBHOOK_ID: optionalString,
  PADDLE_API_KEY: optionalString,
  PADDLE_WEBHOOK_SECRET: optionalString,
  NMI_SECURITY_KEY: optionalString,
  NMI_WEBHOOK_SECRET: optionalString,
  TWOCHECKOUT_MERCHANT_CODE: optionalString,
  TWOCHECKOUT_SECRET_KEY: optionalString,
  TWOCHECKOUT_WEBHOOK_SECRET: optionalString,
  ADYEN_API_KEY: optionalString,
  ADYEN_MERCHANT_ACCOUNT: optionalString,
  ADYEN_CLIENT_KEY: optionalString,
  ADYEN_HMAC_KEY: optionalString,
  ADYEN_ENVIRONMENT: z.enum(['test', 'live']).optional(),
  NIUM_API_KEY: optionalString,
  NIUM_CLIENT_HASH_ID: optionalString,
  NIUM_WEBHOOK_SECRET: optionalString,
  NIUM_ENVIRONMENT: z.enum(['sandbox', 'production']).optional(),
  LOCAL_RAIL_1_APP_KEY: optionalString,
  LOCAL_RAIL_1_APP_SECRET: optionalString,
  LOCAL_RAIL_1_USERNAME: optionalString,
  LOCAL_RAIL_1_PASSWORD: optionalString,
  LOCAL_RAIL_2_MERCHANT_ID: optionalString,
  LOCAL_RAIL_2_PUBLIC_KEY: optionalString,
  LOCAL_RAIL_2_PRIVATE_KEY: optionalString,

  // Section 6 - file storage (optional fallback, defaults to Google Drive).
  STORAGE_PROVIDER: z
    .enum(['google_drive', 'supabase', 'r2', 's3', 'b2', 'wasabi', 'local'])
    .default('google_drive'),
  GOOGLE_DRIVE_CLIENT_EMAIL: optionalString,
  GOOGLE_DRIVE_PRIVATE_KEY: optionalString,
  GOOGLE_DRIVE_ROOT_FOLDER_ID: optionalString,
  STORAGE_S3_ENDPOINT: optionalString,
  STORAGE_S3_REGION: optionalString,
  STORAGE_S3_BUCKET: optionalString,
  STORAGE_S3_ACCESS_KEY_ID: optionalString,
  STORAGE_S3_SECRET_ACCESS_KEY: optionalString,
  STORAGE_S3_FORCE_PATH_STYLE: optionalString,

  // Section 7 - messaging channels (optional).
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString,
  WHATSAPP_ACCESS_TOKEN: optionalString,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalString,
  SMS_PROVIDER_API_KEY: optionalString,
  SMS_PROVIDER_SENDER_ID: optionalString,
  TELEGRAM_BOT_TOKEN: optionalString,
  VIBER_AUTH_TOKEN: optionalString,

  // Section 8 - security and monitoring (optional).
  TURNSTILE_SECRET_KEY: optionalString,
  SENTRY_AUTH_TOKEN: optionalString,
  SENTRY_ORG: optionalString,
  SENTRY_PROJECT: optionalString,

  // Section 9 - marketing and analytics (optional).
  META_CONVERSIONS_API_TOKEN: optionalString,
  GOOGLE_SITE_VERIFICATION: optionalString,
  BING_SITE_VERIFICATION: optionalString,

  // Section 10 - e-commerce and data services (optional).
  SHOPIFY_API_KEY: optionalString,
  SHOPIFY_API_SECRET: optionalString,
  WOOCOMMERCE_WEBHOOK_SECRET: optionalString,
  BANK_FEED_PROVIDER_KEY: optionalString,
  OCR_PROVIDER_API_KEY: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Formats every Zod validation issue into one readable, multi-line message
 * so a misconfigured deployment fails with an actionable error instead of a
 * generic stack trace.
 *
 * @param error The Zod error raised while parsing `process.env`.
 * @returns A human readable summary of every invalid or missing variable.
 */
function formatValidationError(error: z.ZodError<ServerEnv>): string {
  const lines = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  return [
    'Invalid or missing environment variables. Copy .env.example to .env and',
    'fill in every required value before starting the application:',
    ...lines,
  ].join('\n');
}

/**
 * Validates `process.env` once per server process and returns a frozen,
 * fully typed configuration object. Throws immediately on the first
 * invalid value so misconfiguration is caught at boot, not at request time.
 *
 * @returns The validated, typed server environment.
 */
function loadServerEnv(): Readonly<ServerEnv> {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(formatValidationError(result.error));
  }

  return Object.freeze(result.data);
}

export const serverEnv: Readonly<ServerEnv> = loadServerEnv();
