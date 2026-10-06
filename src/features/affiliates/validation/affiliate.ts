// src/features/affiliates/validation/affiliate.ts
// What a referral partner may send us, and in what shape.

import { z } from 'zod';

import {
  countryCodeSchema,
  emailSchema,
  positiveMoneySchema,
  uuidSchema,
} from '@/lib/validation/primitives';

/** Empty text is kept as nothing rather than an empty string. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const referralCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'A referral code is at least three characters.')
  .max(30, 'Keep the referral code under thirty characters.')
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'Use lower case letters, numbers and hyphens, starting with a letter or number.'
  );

export const applyAffiliateSchema = z.object({
  referralCode: referralCodeSchema,
  displayName: z
    .string()
    .trim()
    .min(2, 'Tell us what to call you.')
    .max(80, 'Keep the name under eighty characters.'),
  contactEmail: emailSchema,
  promotionMethod: optionalText(400),
  website: optionalText(200),
  countryCode: countryCodeSchema.optional(),
  hasAcceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Accept the programme terms before applying.' }),
  }),
});

export type ApplyAffiliateInput = z.infer<typeof applyAffiliateSchema>;

export const updateAffiliateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Tell us what to call you.')
    .max(80, 'Keep the name under eighty characters.'),
  contactEmail: emailSchema,
  promotionMethod: optionalText(400),
  website: optionalText(200),
  countryCode: countryCodeSchema.optional(),
});

export type UpdateAffiliateProfileInput = z.infer<typeof updateAffiliateProfileSchema>;

export const saveAffiliateLinkSchema = z.object({
  linkId: uuidSchema.optional(),
  slug: referralCodeSchema.max(40, 'Keep the link name under forty characters.'),
  label: z
    .string()
    .trim()
    .min(2, 'Give the link a name you will recognise.')
    .max(80, 'Keep the name under eighty characters.'),
  destinationPath: z
    .string()
    .trim()
    .regex(/^\/[A-Za-z0-9/_-]*$/, 'A destination starts with a slash, for example /pricing.')
    .max(120, 'Keep the destination short.')
    .default('/'),
  campaign: optionalText(60),
  isActive: z.boolean().default(true),
});

export type SaveAffiliateLinkInput = z.infer<typeof saveAffiliateLinkSchema>;

export const requestAffiliatePayoutSchema = z.object({
  amount: positiveMoneySchema,
  payoutAccountId: uuidSchema.optional(),
});

export type RequestAffiliatePayoutInput = z.infer<typeof requestAffiliatePayoutSchema>;

export const reviewAffiliateSchema = z
  .object({
    affiliateId: uuidSchema,
    isApproved: z.boolean(),
    note: optionalText(300),
  })
  .refine((value) => value.isApproved || (value.note !== null && value.note.length >= 3), {
    message: 'Say why the application is being refused.',
    path: ['note'],
  });

export type ReviewAffiliateInput = z.infer<typeof reviewAffiliateSchema>;
