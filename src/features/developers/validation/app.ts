// src/features/developers/validation/app.ts
// What a developer application must contain before anything is saved.

import { z } from 'zod';

import { API_SCOPE_KEYS } from '@/features/developers/scopes';
import { emailSchema, uuidSchema } from '@/lib/validation/primitives';

const optionalUrlSchema = z
  .string()
  .trim()
  .max(500, 'Keep the address under 500 characters.')
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine(
    (value) => value === null || /^https:\/\/[^\s?#]+$/.test(value),
    'Enter an address that starts with https.'
  );

const scopeSchema = z
  .string()
  .refine((value) => API_SCOPE_KEYS.includes(value), 'That permission does not exist.');

export const registerAppSchema = z.object({
  appSlug: z
    .string()
    .trim()
    .min(3, 'An address is at least three characters.')
    .max(50, 'Keep the address under 50 characters.')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      'Use lowercase letters, numbers and hyphens, starting and ending with a letter or number.'
    ),
  appName: z
    .string()
    .trim()
    .min(2, 'Give the application a name.')
    .max(60, 'Keep the name under 60 characters.'),
  appType: z.enum(['oauth', 'api_key', 'extension', 'webhook_consumer']),
  requestedScopes: z
    .array(scopeSchema)
    .min(1, 'Choose at least one permission the application needs.')
    .max(20, 'Choose fewer permissions.'),
});

export const saveAppSchema = z.object({
  appId: uuidSchema,
  appName: z
    .string()
    .trim()
    .min(2, 'Give the application a name.')
    .max(60, 'Keep the name under 60 characters.'),
  tagline: z
    .string()
    .trim()
    .max(120, 'Keep the tagline under 120 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  description: z
    .string()
    .trim()
    .max(2000, 'Keep the description under 2000 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  homepageUrl: optionalUrlSchema,
  privacyPolicyUrl: optionalUrlSchema,
  supportEmail: emailSchema.optional().nullable(),
  webhookUrl: optionalUrlSchema,
  distribution: z.enum(['private', 'unlisted', 'public']),
});

export const setRedirectUrisSchema = z.object({
  appId: uuidSchema,
  redirectUris: z
    .array(
      z
        .string()
        .trim()
        .min(8, 'Enter the full return address.')
        .max(500, 'Keep the address under 500 characters.')
    )
    .max(10, 'An application may register up to ten return addresses.'),
});

export const submitAppSchema = z.object({
  appId: uuidSchema,
  requestedScopes: z.array(scopeSchema).min(1, 'Choose at least one permission.'),
});

export const appIdSchema = z.object({ appId: uuidSchema });

export const reviewAppSchema = z.object({
  appId: uuidSchema,
  decision: z.enum(['approve', 'reject', 'suspend', 'retire']),
  allowedScopes: z.array(scopeSchema).max(20).default([]),
  reason: z
    .string()
    .trim()
    .max(300, 'Keep the note under 300 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const authoriseAppSchema = z.object({
  clientId: z
    .string()
    .trim()
    .min(8, 'That application address is not valid.')
    .max(80, 'That application address is not valid.'),
  redirectUri: z.string().trim().min(8, 'That return address is not valid.').max(500),
  scopes: z.array(scopeSchema).min(1, 'An application has to ask for something.'),
  state: z.string().trim().max(500).optional(),
  codeChallenge: z.string().trim().max(200).optional(),
  codeChallengeMethod: z.enum(['S256', 'plain']).optional(),
});

export const disconnectAppSchema = z.object({
  installId: uuidSchema,
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type RegisterAppInput = z.input<typeof registerAppSchema>;
export type SaveAppInput = z.input<typeof saveAppSchema>;
export type ReviewAppInput = z.input<typeof reviewAppSchema>;
