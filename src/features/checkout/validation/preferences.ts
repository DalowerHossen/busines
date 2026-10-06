// src/features/checkout/validation/preferences.ts
// What a seller may say about how they are willing to be paid.

import { z } from 'zod';

import { moneySchema } from '@/lib/validation/primitives';

export const checkoutPreferencesSchema = z
  .object({
    acceptCardPayments: z.boolean(),
    acceptBankTransfer: z.boolean().default(true),
    acceptLocalMethods: z.boolean().default(true),
    requireTermsAcceptance: z.boolean().default(true),
    requireDeliveryConfirmation: z.boolean().default(false),
    requireBillingAddress: z.boolean().default(true),
    blockMismatchedCountry: z.boolean().default(false),
    cardMinimumAmount: moneySchema.default('0'),
    cardMaximumAmount: moneySchema.optional(),
    consentStatement: z
      .string()
      .trim()
      .min(20, 'Say clearly what the payer is agreeing to.')
      .max(600, 'Keep the statement under six hundred characters.'),
    refundWindowDays: z.coerce
      .number()
      .int()
      .min(0, 'A refund window cannot be negative.')
      .max(180, 'A window longer than six months is not a window.'),
  })
  .superRefine((value, context) => {
    if (
      value.cardMaximumAmount !== undefined &&
      Number.parseFloat(value.cardMaximumAmount) <= Number.parseFloat(value.cardMinimumAmount)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cardMaximumAmount'],
        message: 'The ceiling has to be above the minimum.',
      });
    }
  });

export type CheckoutPreferencesInput = z.infer<typeof checkoutPreferencesSchema>;
