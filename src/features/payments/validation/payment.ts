// src/features/payments/validation/payment.ts
// What a valid payment looks like: an amount above zero, a method, and either
// an invoice to settle or a client the money sits against.

import { z } from 'zod';

import { emailSchema, isoDateSchema, moneySchema, uuidSchema } from '@/lib/validation/primitives';
import { GATEWAY_PROVIDERS, PAYMENT_METHOD_TYPES } from '@/types/enums';

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

const positiveAmountSchema = moneySchema.refine(
  (value) => Number.parseFloat(value) > 0,
  'Enter an amount above zero.'
);

export const recordPaymentSchema = z.object({
  invoiceId: optionalUuid,
  amount: positiveAmountSchema,
  methodType: z.enum(PAYMENT_METHOD_TYPES).default('bank_transfer'),
  provider: z.enum(GATEWAY_PROVIDERS).default('manual'),
  receivedOn: isoDateSchema,
  reference: optionalText(120),
  gatewayFeeAmount: z
    .union([moneySchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? '0' : value)),
  payerName: optionalText(160),
  payerEmail: z
    .union([emailSchema, z.literal('')])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  notes: optionalText(2000),
});

export const allocatePaymentSchema = z.object({
  paymentId: uuidSchema,
  invoiceId: uuidSchema,
  amount: z
    .union([positiveAmountSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
});

export const reverseAllocationSchema = z.object({
  allocationId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(3, 'Give a short reason so the audit trail explains itself.')
    .max(300, 'Keep the reason under 300 characters.'),
});

export const paymentIdSchema = z.object({ paymentId: uuidSchema });

export const paymentListFiltersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  clientId: optionalUuid,
  methodType: z
    .union([z.enum(PAYMENT_METHOD_TYPES), z.literal('all'), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' || value === 'all' ? null : value)),
  fromDate: z
    .union([isoDateSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  toDate: z
    .union([isoDateSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  onlyUnallocated: z
    .union([z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((value) => value === '1'),
  includeDeleted: z
    .union([z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((value) => value === '1'),
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type AllocatePaymentInput = z.input<typeof allocatePaymentSchema>;
