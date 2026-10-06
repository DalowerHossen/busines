// src/features/resellers/validation/reseller.ts
// What a white label partner may send us, and in what shape.

import { z } from 'zod';

import { countryCodeSchema, emailSchema, uuidSchema } from '@/lib/validation/primitives';

/** Empty text is kept as nothing rather than an empty string. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'An address is at least three characters.')
  .max(64, 'Keep the address under sixty-four characters.')
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Use lower case letters, numbers and hyphens, starting and ending with a letter or number.'
  );

const colourSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six digit colour, for example #1d4ed8.')
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const applyResellerSchema = z.object({
  partnerName: z
    .string()
    .trim()
    .min(2, 'Tell us the name of your business.')
    .max(120, 'Keep the name under one hundred and twenty characters.'),
  slug: slugSchema,
  contactEmail: emailSchema,
  contactPhone: optionalText(40),
  countryCode: countryCodeSchema,
  brandName: optionalText(120),
  hasAcceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Accept the partner agreement before applying.' }),
  }),
});

export type ApplyResellerInput = z.infer<typeof applyResellerSchema>;

export const updateResellerBrandSchema = z.object({
  partnerName: z
    .string()
    .trim()
    .min(2, 'Tell us the name of your business.')
    .max(120, 'Keep the name under one hundred and twenty characters.'),
  contactEmail: emailSchema,
  contactPhone: optionalText(40),
  brandName: optionalText(120),
  brandLogoUrl: optionalText(400),
  brandPrimaryColor: colourSchema,
  brandAccentColor: colourSchema,
  customDomain: optionalText(120),
  hidePlatformBranding: z.boolean().default(false),
});

export type UpdateResellerBrandInput = z.infer<typeof updateResellerBrandSchema>;

export const provisionAccountSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(2, 'Enter the registered name of the business.')
    .max(200, 'Keep the name under two hundred characters.'),
  displayName: z
    .string()
    .trim()
    .min(2, 'Enter the name this business trades under.')
    .max(120, 'Keep the name under one hundred and twenty characters.'),
  slug: slugSchema,
  accountReference: optionalText(60),
});

export type ProvisionAccountInput = z.infer<typeof provisionAccountSchema>;

export const setAccountStatusSchema = z.object({
  companyId: uuidSchema,
  status: z.enum(['active', 'suspended', 'released']),
  reason: optionalText(200),
});

export type SetAccountStatusInput = z.infer<typeof setAccountStatusSchema>;

export const reviewResellerSchema = z
  .object({
    resellerId: uuidSchema,
    isApproved: z.boolean(),
    note: optionalText(300),
    revenueShare: z.coerce.number().min(0).max(100).optional(),
    maxSubTenants: z.coerce.number().int().min(1).max(100000).optional(),
  })
  .refine((value) => value.isApproved || (value.note !== null && value.note.length >= 3), {
    message: 'Say why the application is being refused.',
    path: ['note'],
  });

export type ReviewResellerInput = z.infer<typeof reviewResellerSchema>;
