// src/features/billing/validation/billing.ts
// What a plan change, a cancellation, a restart and a discount code must
// contain before anything is written.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';
import { BILLING_INTERVALS } from '@/types/enums';

export const changePlanSchema = z.object({
  planId: uuidSchema,
  interval: z.enum(BILLING_INTERVALS).default('monthly'),
  reason: z
    .string()
    .trim()
    .max(300, 'Keep the note under 300 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type ChangePlanInput = z.infer<typeof changePlanSchema>;

export const cancelPlanSchema = z.object({
  /** False keeps the plan running until the paid period ends. */
  isImmediate: z.boolean().default(false),
  reason: z
    .string()
    .trim()
    .min(3, 'Tell us in a few words why you are leaving.')
    .max(300, 'Keep the reason under 300 characters.'),
});

export type CancelPlanInput = z.infer<typeof cancelPlanSchema>;

export const resumePlanSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(300, 'Keep the note under 300 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type ResumePlanInput = z.infer<typeof resumePlanSchema>;

export const redeemCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Enter the code exactly as you received it.')
    .max(40, 'A discount code is never this long.')
    .transform((value) => value.toUpperCase()),
});

export type RedeemCouponInput = z.infer<typeof redeemCouponSchema>;
