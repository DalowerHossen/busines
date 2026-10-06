// src/features/payouts/validation/payment-rail.ts
// What a connection to Adyen or Nium must contain before it is saved.

import { z } from 'zod';

import { countryCodeSchema, currencyCodeSchema, uuidSchema } from '@/lib/validation/primitives';

const referenceSchema = z
  .string()
  .trim()
  .max(80, 'Keep the reference under 80 characters.')
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const connectPaymentRailSchema = z
  .object({
    rail: z.enum(['adyen', 'nium']),
    mode: z.enum(['test', 'live']),
    accountHolderReference: referenceSchema,
    balanceAccountReference: referenceSchema,
    walletReference: referenceSchema,
    defaultCurrency: currencyCodeSchema,
    countryCode: countryCodeSchema,
    platformFeePercentage: z
      .number()
      .min(0, 'A commission cannot be negative.')
      .max(30, 'A commission above thirty per cent is not allowed.')
      .default(0),
  })
  .refine(
    (value) =>
      value.rail === 'nium' ||
      value.accountHolderReference !== null ||
      value.balanceAccountReference !== null,
    {
      message: 'Enter the account holder or the balance account Adyen gave you.',
      path: ['balanceAccountReference'],
    }
  )
  .refine(
    (value) =>
      value.rail === 'adyen' ||
      value.walletReference !== null ||
      value.accountHolderReference !== null,
    {
      message: 'Enter the Nium wallet or customer this business is paid from.',
      path: ['walletReference'],
    }
  );

export const refreshPaymentRailSchema = z.object({
  accountId: uuidSchema,
});

export type ConnectPaymentRailInput = z.input<typeof connectPaymentRailSchema>;
export type RefreshPaymentRailInput = z.input<typeof refreshPaymentRailSchema>;
