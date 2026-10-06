// src/env/server.ts
// Server only configuration. Importing this module from browser code throws,
// so a secret can never be bundled by accident.

import 'server-only';

import { z } from 'zod';

/**
 * Treats an empty variable as an absent one.
 *
 * Deployment platforms habitually set every variable they know about, with
 * an empty value where nothing was filled in. Without this, an empty
 * optional field fails validation and the whole build stops over a setting
 * nobody uses.
 *
 * @param value Raw value from the environment.
 * @returns The value, or undefined when it carries nothing.
 */
function blankAsMissing(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

/** An optional string that tolerates an empty variable. */
const optionalText = z.preprocess(blankAsMissing, z.string().optional());

/** An optional web address that tolerates an empty variable. */
const optionalUrl = z.preprocess(blankAsMissing, z.string().url().optional());

const serverEnvSchema = z.object({
  APP_ENV: z.preprocess(
    blankAsMissing,
    z.enum(['development', 'test', 'production']).default('development')
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_DB_URL: optionalText,
  ENCRYPTION_KEY: z.string().min(32),
  LINK_SIGNING_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(16),
  RESEND_API_KEY: optionalText,
  EMAIL_FROM_ADDRESS: z.preprocess(
    blankAsMissing,
    z.string().email().default('support@kdsolutionit.com')
  ),
  EMAIL_FROM_NAME: z.preprocess(blankAsMissing, z.string().default('KD SOLUTION IT')),
  EMAIL_REPLY_TO: z.preprocess(
    blankAsMissing,
    z.string().email().default('support@kdsolutionit.com')
  ),
  SMTP_HOST: optionalText,
  SMTP_PORT: z.preprocess(blankAsMissing, z.coerce.number().int().positive().optional()),
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  STORAGE_PROVIDER: z.preprocess(
    blankAsMissing,
    z.enum(['supabase', 'r2', 's3', 'b2', 'wasabi', 'local']).default('supabase')
  ),
  STORAGE_S3_ENDPOINT: optionalText,
  STORAGE_S3_REGION: z.preprocess(blankAsMissing, z.string().default('auto')),
  STORAGE_S3_BUCKET: optionalText,
  STORAGE_S3_ACCESS_KEY_ID: optionalText,
  STORAGE_S3_SECRET_ACCESS_KEY: optionalText,
  GOOGLE_DRIVE_CLIENT_ID: optionalText,
  GOOGLE_DRIVE_CLIENT_SECRET: optionalText,
  OCR_PROVIDER_URL: optionalUrl,
  OCR_PROVIDER_API_KEY: optionalText,
  TURNSTILE_SECRET_KEY: optionalText,
  SENTRY_AUTH_TOKEN: optionalText,
  LOG_LEVEL: z.preprocess(blankAsMissing, z.enum(['debug', 'info', 'warn', 'error']).optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const parsedServerEnv = serverEnvSchema.safeParse(process.env);

if (!parsedServerEnv.success) {
  const missing = parsedServerEnv.error.issues
    .map((issue) => `${issue.path.join('.')} (${issue.message})`)
    .join(', ');
  throw new Error(`Server environment variables are missing or invalid: ${missing}`);
}

export const serverEnv: ServerEnv = parsedServerEnv.data;

/**
 * Reports whether the application is running in production.
 *
 * @returns True in the production environment.
 */
export function isProduction(): boolean {
  return serverEnv.APP_ENV === 'production';
}

/**
 * Reports whether the application is running against test fixtures.
 *
 * @returns True in the test environment.
 */
export function isTestEnvironment(): boolean {
  return serverEnv.APP_ENV === 'test';
}
