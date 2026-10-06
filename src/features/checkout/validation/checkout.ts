// src/features/checkout/validation/checkout.ts
// What a request to start an online payment must contain.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const startCheckoutSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, 'This payment link is not complete.')
    .max(400, 'This payment link is not valid.'),
  gatewayId: uuidSchema,
  /** The exact words the payer agreed to, as shown on the page. */
  consentStatement: z.string().trim().min(20).max(600),
  /** True when the payer ticked the agreement. */
  hasAgreed: z.literal(true, {
    errorMap: () => ({ message: 'Tick the box to confirm before paying.' }),
  }),
  /** Where the payer is, as their own browser reports it. */
  timeZone: z.string().trim().max(60).optional(),
  acceptLanguage: z.string().trim().max(60).optional(),
  screenFingerprint: z.string().trim().max(120).optional(),
  /** How long they had the invoice open before paying. */
  viewedSeconds: z.coerce.number().int().min(0).max(86400).optional(),
});

export type StartCheckoutInput = z.input<typeof startCheckoutSchema>;
