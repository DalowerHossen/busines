// src/features/estimates/validation/estimate.ts
// What a valid estimate looks like before it reaches the database: at least
// one line, a client, a validity date that is not in the past relative to the
// issue date, and money with two decimal places.

import { z } from 'zod';

import { isoDateSchema, moneySchema, uuidSchema } from '@/lib/validation/primitives';
import { ESTIMATE_STATUSES } from '@/types/enums';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalUuid = z
  .union([uuidSchema, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d{1,11}(\.\d{1,3})?$/, 'Enter a quantity with up to three decimal places.')
  .refine((value) => Number.parseFloat(value) > 0, 'A line needs a quantity above zero.');

const percentageTextSchema = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,4})?$/, 'Enter a percentage with up to four decimal places.')
      .refine(
        (value) => Number.parseFloat(value) <= 100,
        'A percentage cannot be above one hundred.'
      ),
    z.literal(''),
  ])
  .optional()
  .transform((value) => (value === undefined || value === '' ? '0' : value));

export const estimateLineSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Describe what this line is for.')
    .max(500, 'Keep the line description under 500 characters.'),
  quantity: quantitySchema,
  unitPrice: moneySchema.refine(
    (value) => Number.parseFloat(value) >= 0,
    'A price cannot be negative.'
  ),
  unitLabel: optionalText(40),
  discountValue: z
    .union([moneySchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? '0' : value)),
  taxPercentage: percentageTextSchema,
  productId: optionalUuid,
  taxRateId: optionalUuid,
});

export const estimateBaseSchema = z.object({
  clientId: uuidSchema,
  title: optionalText(160),
  currency: z
    .string()
    .trim()
    .length(3, 'A currency code has three letters.')
    .transform((value) => value.toUpperCase()),
  issueDate: isoDateSchema,
  validUntil: z
    .union([isoDateSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  notes: optionalText(2000),
  termsAndConditions: optionalText(4000),
  footerNote: optionalText(500),
  shippingAmount: z
    .union([moneySchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? '0' : value)),
  lines: z.array(estimateLineSchema).min(1, 'An estimate needs at least one line.').max(200),
});

interface EstimateDateRules {
  issueDate: string;
  validUntil: string | null;
}

/**
 * Checks the rule the database enforces on the validity date.
 *
 * @param value Parsed estimate values.
 * @param context Refinement context collecting the issue.
 * @returns Nothing.
 */
function checkEstimateDates(value: EstimateDateRules, context: z.RefinementCtx): void {
  if (value.validUntil !== null && value.validUntil < value.issueDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validUntil'],
      message: 'The validity date cannot fall before the issue date.',
    });
  }
}

export const createEstimateSchema = estimateBaseSchema.superRefine(checkEstimateDates);

export const updateEstimateSchema = estimateBaseSchema
  .extend({ estimateId: uuidSchema })
  .superRefine(checkEstimateDates);

export const estimateIdSchema = z.object({ estimateId: uuidSchema });

export const sendEstimateSchema = z.object({
  estimateId: uuidSchema,
  issueDate: isoDateSchema.optional(),
});

export const approveEstimateSchema = z.object({
  estimateId: uuidSchema,
  approvedByName: optionalText(160),
});

export const declineEstimateSchema = z.object({
  estimateId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(3, 'Give a short reason so the audit trail explains itself.')
    .max(300, 'Keep the reason under 300 characters.'),
});

export const cancelEstimateSchema = declineEstimateSchema;

export const estimateListFiltersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  status: z
    .union([z.enum(ESTIMATE_STATUSES), z.literal('all'), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' || value === 'all' ? null : value)),
  clientId: optionalUuid,
  fromDate: z
    .union([isoDateSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  toDate: z
    .union([isoDateSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  includeDeleted: z
    .union([z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((value) => value === '1'),
});

export type EstimateLineInput = z.input<typeof estimateLineSchema>;
export type EstimateLineValues = z.infer<typeof estimateLineSchema>;
export type CreateEstimateInput = z.input<typeof createEstimateSchema>;
export type UpdateEstimateInput = z.input<typeof updateEstimateSchema>;
