// src/features/settlements/validation/settlement.ts
// What the platform team is allowed to type into the collection terms.
//
// The bounds here are the same ones the database enforces, so a mistake is
// caught while the person is still looking at the form rather than after
// they press save.

import { z } from 'zod';

import { moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const settlementPolicySchema = z.object({
  /** Null edits the standard terms every account falls back to. */
  companyId: uuidSchema.nullable().default(null),
  name: z
    .string()
    .trim()
    .min(2, 'Give these terms a name you will recognise later.')
    .max(60, 'Keep the name under sixty characters.'),
  feePercentage: z.coerce
    .number()
    .min(0, 'A fee cannot be negative.')
    .max(10, 'A fee above ten percent is almost certainly a typing mistake.'),
  minimumFee: moneySchema,
  fixedFee: moneySchema.default('0'),
  holdDays: z.coerce
    .number()
    .int()
    .min(0, 'A hold period cannot be negative.')
    .max(90, 'A hold longer than ninety days is not a hold, it is a freeze.'),
  payoutSlaHours: z.coerce
    .number()
    .int()
    .min(1, 'Promise at least one hour.')
    .max(168, 'A promise longer than a week is not worth making.'),
  payoutThreshold: moneySchema,
  notes: z.string().trim().max(300, 'Keep the note under three hundred characters.').optional(),
});

export type SettlementPolicyInput = z.infer<typeof settlementPolicySchema>;

export const removeSettlementPolicySchema = z.object({
  companyId: uuidSchema,
});
