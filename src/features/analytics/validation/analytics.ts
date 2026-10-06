// src/features/analytics/validation/analytics.ts
// What may be typed into the measurement console.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const MEASUREMENT_PROVIDERS = [
  'ga4',
  'gtm',
  'meta_pixel',
  'tiktok',
  'linkedin',
  'x_ads',
  'clarity',
  'plausible',
  'search_console',
] as const;

export const saveDestinationSchema = z.object({
  providerKey: z.enum(MEASUREMENT_PROVIDERS),
  label: z
    .string()
    .trim()
    .min(2, 'Give this destination a name you will recognise.')
    .max(60, 'Keep the name under sixty characters.'),
  publicIdentifier: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9_.:-]{4,80}$/,
      'That does not look like a measurement identifier. Copy it from the provider.'
    ),
  consentCategory: z.enum(['necessary', 'analytics', 'marketing']),
  isEnabled: z.boolean().default(false),
  loadsOnMarketingPages: z.boolean().default(true),
  loadsOnApplicationPages: z.boolean().default(false),
  /** Only for the tools that also accept reports from a server. */
  accessToken: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(300).optional(),
});

export const destinationIdSchema = z.object({
  destinationId: uuidSchema,
});
