import { z } from 'zod';
import {
  currencyCodeSchema,
  idempotencyKeySchema,
  isoDateTimeSchema,
  nonNegativeAmountSchema,
  positiveAmountSchema,
  shortTextSchema,
  uuidSchema,
} from './common';

export const gatewayIdSchema = z.enum([
  'stripe',
  'paypal',
  'paddle',
  'nmi',
  'two_checkout',
  'adyen_for_platforms',
  'nium',
  'local_rail_1',
  'local_rail_2',
  'manual_bank_transfer',
  'custom',
]);

export const settlementPathSchema = z.enum(['own_gateway', 'platform_mor']);

export const paymentCreateSchema = z
  .object({
    invoiceId: uuidSchema.nullable().optional(),
    clientId: uuidSchema,
    gateway: gatewayIdSchema,
    amount: positiveAmountSchema,
    currency: currencyCodeSchema,
    savedPaymentMethodId: uuidSchema.nullable().optional(),
    is3dsEnabled: z.boolean().default(false),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const paymentConfirmationSchema = z
  .object({
    paymentId: uuidSchema,
    gatewayTransactionId: shortTextSchema.max(
      255,
      'Gateway transaction ID must be 255 characters or fewer.'
    ),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const paymentCaptureSchema = z
  .object({
    paymentId: uuidSchema,
    amount: positiveAmountSchema.nullable().optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const refundCreateSchema = z
  .object({
    paymentId: uuidSchema,
    amount: positiveAmountSchema,
    reason: shortTextSchema
      .max(1_000, 'Reason must be 1,000 characters or fewer.')
      .nullable()
      .optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const savedPaymentMethodSchema = z
  .object({
    clientId: uuidSchema,
    gateway: gatewayIdSchema,
    gatewayToken: shortTextSchema.max(512, 'Gateway token must be 512 characters or fewer.'),
    cardBrand: z
      .string()
      .trim()
      .max(64, 'Card brand must be 64 characters or fewer.')
      .nullable()
      .optional(),
    cardLastFourDigits: z
      .string()
      .trim()
      .regex(/^[0-9]{4}$/u, 'Card last four digits must contain four digits.')
      .nullable()
      .optional(),
    expiryMonth: z
      .number()
      .int()
      .min(1, 'Expiry month is invalid.')
      .max(12, 'Expiry month is invalid.')
      .nullable()
      .optional(),
    expiryYear: z
      .number()
      .int()
      .min(2020, 'Expiry year is invalid.')
      .max(2200, 'Expiry year is invalid.')
      .nullable()
      .optional(),
    isDefault: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.expiryMonth === null) !== (value.expiryYear === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryYear'],
        message: 'Expiry month and year must be provided together.',
      });
    }
  });

export const chargebackCreateSchema = z
  .object({
    paymentId: uuidSchema,
    amount: positiveAmountSchema,
    reasonCode: shortTextSchema.max(128, 'Reason code must be 128 characters or fewer.'),
    gatewayCaseId: shortTextSchema
      .max(255, 'Gateway case ID must be 255 characters or fewer.')
      .nullable()
      .optional(),
    respondByDate: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export const paymentMethodDeleteSchema = z
  .object({
    savedPaymentMethodId: uuidSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const paymentListFilterSchema = z
  .object({
    clientId: uuidSchema.optional(),
    invoiceId: uuidSchema.optional(),
    status: z
      .enum([
        'pending',
        'authorized',
        'captured',
        'failed',
        'refunded',
        'partially_refunded',
        'disputed',
        'cancelled',
      ])
      .optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    currency: currencyCodeSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from && value.to && Date.parse(value.to) < Date.parse(value.from)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'End date cannot be earlier than start date.',
      });
    }
  });

export const paymentAmountAdjustmentSchema = z
  .object({
    paymentId: uuidSchema,
    amount: nonNegativeAmountSchema,
    currency: currencyCodeSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
