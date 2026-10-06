// src/features/refunds/validation/refund.ts
// What a refund request and its review must contain.

import { z } from 'zod';

import { moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const recordRefundSchema = z.object({
  paymentId: uuidSchema,
  amount: moneySchema.refine(
    (value) => Number.parseFloat(value) > 0,
    'Enter an amount above zero.'
  ),
  reason: z
    .string()
    .trim()
    .min(4, 'Say why the money is going back. Your records will need it later.')
    .max(400, 'Keep the reason under 400 characters.'),
});

export const reviewRefundSchema = z
  .object({
    refundId: uuidSchema,
    approve: z.boolean(),
    reason: z
      .string()
      .trim()
      .max(400, 'Keep the reason under 400 characters.')
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .refine((value) => value.approve || value.reason !== null, {
    message: 'Say why the refund is being declined.',
    path: ['reason'],
  });

export type RecordRefundInput = z.input<typeof recordRefundSchema>;
export type ReviewRefundInput = z.input<typeof reviewRefundSchema>;
