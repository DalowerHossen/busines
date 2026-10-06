// src/features/admin/validation/payout-review.ts
// What the platform team must supply before a payout is released or refused.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const reviewPayoutSchema = z
  .object({
    payoutId: uuidSchema,
    isApproved: z.boolean(),
    note: z
      .string()
      .trim()
      .max(300, 'Keep the note under 300 characters.')
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .refine((value) => value.isApproved || (value.note !== null && value.note.length >= 3), {
    message: 'Say why this payout is being refused.',
    path: ['note'],
  });

export type ReviewPayoutInput = z.infer<typeof reviewPayoutSchema>;
