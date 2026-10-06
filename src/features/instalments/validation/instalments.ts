// src/features/instalments/validation/instalments.ts
// What the interface will accept when instalment terms are written, a plan
// is agreed, or an arrangement is decided on or ended.

import { z } from 'zod';

import { isoDateSchema, moneySchema, uuidSchema } from '@/lib/validation/primitives';

const percentageSchema = z.coerce
  .number()
  .min(0, 'A percentage cannot be below nothing.')
  .max(100, 'A percentage cannot be above a hundred.');

export const saveOfferSchema = z.object({
  offerId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Give these terms a name your clients will understand.').max(80),
  provider: z.enum([
    'self_financed',
    'klarna',
    'afterpay',
    'affirm',
    'zip',
    'tabby',
    'tamara',
    'custom_partner',
  ]),
  description: z.string().trim().max(400).optional(),
  instalmentCount: z.coerce
    .number()
    .int()
    .min(2, 'Paying in parts means at least two payments.')
    .max(60),
  intervalUnit: z.enum(['week', 'month']),
  intervalCount: z.coerce.number().int().min(1).max(12),
  downPaymentPercentage: percentageSchema.max(90, 'A deposit above ninety percent is not a plan.'),
  interestRatePercentage: percentageSchema,
  partnerFeePercentage: percentageSchema,
  lateFeeAmount: moneySchema,
  gracePeriodDays: z.coerce.number().int().min(0).max(60),
  minimumInvoiceAmount: moneySchema,
  maximumInvoiceAmount: moneySchema.optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Use the three letter currency code.'),
  requiresApproval: z.boolean().default(false),
});

export const setOfferActiveSchema = z.object({
  offerId: uuidSchema,
  isActive: z.boolean(),
});

export const createPlanSchema = z.object({
  invoiceId: uuidSchema,
  offerId: uuidSchema,
  firstDueDate: isoDateSchema.optional(),
});

export const decidePlanSchema = z.object({
  planId: uuidSchema,
  isApproved: z.boolean(),
  reason: z.string().trim().max(200).optional(),
});

export const cancelPlanSchema = z.object({
  planId: uuidSchema,
  reason: z.string().trim().min(3, 'Say why the arrangement is ending.').max(200),
});
