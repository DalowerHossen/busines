// src/features/contracts/validation/contracts.ts
// What the interface will accept when an agreement is drafted, sent, signed
// or stopped.

import { z } from 'zod';

import { isoDateSchema, moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const signerSchema = z.object({
  fullName: z.string().trim().min(2, 'Give the name of the person signing.').max(120),
  email: z.string().trim().email('Give a working email address.').max(160),
  roleLabel: z.string().trim().min(2).max(40).default('Client'),
  signingOrder: z.number().int().min(1).max(20),
  isInternal: z.boolean().default(false),
});

export const saveContractSchema = z.object({
  contractId: uuidSchema.optional(),
  title: z.string().trim().min(2, 'Give the agreement a title.').max(200),
  bodyHtml: z.string().trim().min(20, 'An agreement needs wording before it can be saved.'),
  clientId: uuidSchema.optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Use the three letter currency code.')
    .optional(),
  contractValue: moneySchema.optional(),
  effectiveDate: isoDateSchema.optional(),
  expiryDate: isoDateSchema.optional(),
  signingOrderEnforced: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
});

export const setSignersSchema = z.object({
  contractId: uuidSchema,
  signers: z
    .array(signerSchema)
    .min(1, 'Name at least one person who has to sign.')
    .max(20, 'An agreement can have at most twenty parties.'),
});

export const sendContractSchema = z.object({
  contractId: uuidSchema,
  validUntil: isoDateSchema.optional(),
});

export const voidContractSchema = z.object({
  contractId: uuidSchema,
  reason: z.string().trim().min(3, 'Say why this agreement is being stopped.').max(200),
});

export const signContractSchema = z.object({
  token: z.string().trim().min(16).max(128),
  typedSignature: z.string().trim().min(2, 'Type your full name to sign.').max(120),
  hasConsented: z.literal(true, {
    errorMap: () => ({ message: 'Tick the box to agree to sign electronically.' }),
  }),
});

export const declineContractSchema = z.object({
  token: z.string().trim().min(16).max(128),
  reason: z.string().trim().min(3, 'Say why you are not signing.').max(200),
});
