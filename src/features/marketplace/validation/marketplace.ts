// src/features/marketplace/validation/marketplace.ts
// What a valid marketplace request looks like. The rules here match the
// database constraints exactly, so a listing is never refused twice for the
// same reason in two different words.

import { z } from 'zod';

import { emailSchema, positiveMoneySchema, uuidSchema } from '@/lib/validation/primitives';

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, 'Use lower case letters, numbers and hyphens.');

export const LISTING_CATEGORIES = [
  'invoice_template',
  'email_template',
  'chart_of_accounts',
  'report_pack',
  'automation_recipe',
  'industry_preset',
  'tax_profile',
  'checklist',
] as const;

export const LISTING_ARTIFACT_KINDS = [
  'document_template',
  'email_set',
  'account_tree',
  'report_definition',
  'automation',
  'preset_bundle',
] as const;

export const applyVendorSchema = z.object({
  vendorName: z.string().trim().min(2).max(80),
  vendorSlug: slugSchema,
  supportEmail: emailSchema,
  headline: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  bio: z
    .string()
    .trim()
    .max(1200)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const saveListingSchema = z
  .object({
    listingId: uuidSchema.nullable().default(null),
    listingSlug: slugSchema,
    title: z.string().trim().min(3).max(90),
    summary: z.string().trim().min(20).max(200),
    description: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
    category: z.enum(LISTING_CATEGORIES),
    artifactKind: z.enum(LISTING_ARTIFACT_KINDS),
    artifactPayload: z.string().trim().min(2).max(20000),
    pricingModel: z.enum(['free', 'one_time']),
    priceAmount: positiveMoneySchema.or(z.literal('0')),
    priceCurrency: z.string().trim().length(3).toUpperCase(),
    version: z
      .string()
      .trim()
      .regex(/^\d+\.\d+\.\d+$/, 'Use a version such as 1.0.0.'),
  })
  .refine(
    (value) =>
      value.pricingModel === 'free' ? value.priceAmount === '0' : value.priceAmount !== '0',
    { message: 'A free template has no price, and a paid one needs one.', path: ['priceAmount'] }
  );

export const listingIdSchema = z.object({ listingId: uuidSchema });

export const unpublishListingSchema = z.object({
  listingId: uuidSchema,
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const installTemplateSchema = z.object({ listingId: uuidSchema });

export const uninstallTemplateSchema = z.object({
  installId: uuidSchema,
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const rateTemplateSchema = z.object({
  listingId: uuidSchema,
  rating: z.coerce.number().int().min(1).max(5),
  title: z
    .string()
    .trim()
    .max(90)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  body: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const moderateListingSchema = z.object({
  listingId: uuidSchema,
  decision: z.enum(['publish', 'reject']),
  note: z
    .string()
    .trim()
    .max(600)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const reviewVendorSchema = z.object({
  vendorId: uuidSchema,
  approve: z.boolean(),
  note: z
    .string()
    .trim()
    .max(600)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  revenueSharePercentage: z.coerce.number().min(0).max(100).nullable().default(null),
});

export type ApplyVendorInput = z.input<typeof applyVendorSchema>;
export type SaveListingInput = z.input<typeof saveListingSchema>;
export type ModerateListingInput = z.input<typeof moderateListingSchema>;
export type ReviewVendorInput = z.input<typeof reviewVendorSchema>;
