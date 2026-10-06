// src/features/admin/validation/catalogue.ts
// What the platform console must supply before a plan, a price or a discount
// code is written.

import { z } from 'zod';

import { currencyCodeSchema, moneySchema, uuidSchema } from '@/lib/validation/primitives';
import { BILLING_INTERVALS, COUPON_TYPES } from '@/types/enums';

/** One limit or module, entered as a line of text in the console. */
const entitlementLineSchema = z
  .string()
  .trim()
  .max(2000, 'That is too long for this list.')
  .optional()
  .transform((value) => value ?? '');

export const savePlanSchema = z.object({
  planId: uuidSchema.optional(),
  planKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,30}$/, 'Use lower case letters, numbers and underscores.'),
  name: z
    .string()
    .trim()
    .min(1, 'Give the plan a name.')
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
    .max(600, 'Keep the description under 600 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  badgeLabel: z
    .string()
    .trim()
    .max(24, 'Keep the badge under 24 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  isFree: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  isArchived: z.boolean().default(false),
  trialDays: z.coerce.number().int().min(0).max(90).default(0),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
  merchantFeePercentage: moneySchema,
  merchantFeeFixed: moneySchema,
  /** One limit per line, written as key=value, with unlimited for no ceiling. */
  limits: entitlementLineSchema,
  /** One module per line, written as key=true or key=false. */
  features: entitlementLineSchema,
});

export type SavePlanInput = z.infer<typeof savePlanSchema>;

export const savePlanPriceSchema = z.object({
  planId: uuidSchema,
  priceId: uuidSchema.optional(),
  interval: z.enum(BILLING_INTERVALS),
  currency: currencyCodeSchema,
  amount: moneySchema,
  compareAtAmount: moneySchema.optional(),
  isActive: z.boolean().default(true),
});

export type SavePlanPriceInput = z.infer<typeof savePlanPriceSchema>;

export const setDefaultPlanSchema = z.object({
  planId: uuidSchema,
});

export type SetDefaultPlanInput = z.infer<typeof setDefaultPlanSchema>;

export const saveCouponSchema = z
  .object({
    couponId: uuidSchema.optional(),
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/, 'Use letters, numbers, dashes and underscores.')
      .transform((value) => value.toUpperCase()),
    name: z
      .string()
      .trim()
      .min(1, 'Give the code a name your team will recognise.')
      .max(80, 'Keep the name under 80 characters.'),
    couponType: z.enum(COUPON_TYPES),
    value: moneySchema.refine(
      (value) => Number.parseFloat(value) > 0,
      'The value has to be more than zero.'
    ),
    currency: currencyCodeSchema.optional(),
    durationMonths: z.coerce.number().int().min(1).max(120).optional(),
    maxRedemptions: z.coerce.number().int().min(1).max(1000000).optional(),
    maxRedemptionsPerAccount: z.coerce.number().int().min(1).max(10).default(1),
    validUntil: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
    campaignName: z
      .string()
      .trim()
      .max(80, 'Keep the campaign name under 80 characters.')
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
    isActive: z.boolean().default(true),
  })
  .refine((value) => value.couponType !== 'percentage' || Number.parseFloat(value.value) <= 100, {
    message: 'A percentage cannot be more than 100.',
    path: ['value'],
  })
  .refine((value) => value.couponType !== 'fixed_amount' || value.currency !== undefined, {
    message: 'Choose the currency this amount is in.',
    path: ['currency'],
  });

export type SaveCouponInput = z.infer<typeof saveCouponSchema>;

export const setCouponStateSchema = z.object({
  couponId: uuidSchema,
  isActive: z.boolean(),
});

export type SetCouponStateInput = z.infer<typeof setCouponStateSchema>;
