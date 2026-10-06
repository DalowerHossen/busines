// src/features/payouts/validation/payout.ts
// What a payout destination and a payout request must contain.

import { z } from 'zod';

import {
  countryCodeSchema,
  currencyCodeSchema,
  moneySchema,
  uuidSchema,
} from '@/lib/validation/primitives';
import { PAYOUT_METHODS } from '@/types/enums';

export const savePayoutAccountSchema = z.object({
  accountId: uuidSchema.optional(),
  label: z
    .string()
    .trim()
    .min(1, 'Give this destination a name you will recognise.')
    .max(80, 'Keep the name under 80 characters.'),
  method: z.enum(PAYOUT_METHODS),
  accountHolderName: z
    .string()
    .trim()
    .min(2, 'Enter the name on the account.')
    .max(160, 'Keep the name under 160 characters.'),
  accountNumber: z
    .string()
    .trim()
    .min(4, 'Enter the account or wallet number the money should reach.')
    .max(64, 'Keep the number under 64 characters.'),
  bankName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  routingNumber: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  currency: currencyCodeSchema,
  countryCode: countryCodeSchema,
  makeDefault: z.boolean().default(false),
});

export const requestPayoutSchema = z.object({
  amount: moneySchema.refine(
    (value) => Number.parseFloat(value) > 0,
    'Enter an amount above zero.'
  ),
  accountId: uuidSchema,
});

export const cancelPayoutSchema = z.object({
  payoutId: uuidSchema,
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type SavePayoutAccountInput = z.input<typeof savePayoutAccountSchema>;
export type RequestPayoutInput = z.input<typeof requestPayoutSchema>;
