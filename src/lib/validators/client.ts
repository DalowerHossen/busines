import { z } from 'zod';
import {
  addressSchema,
  currencyCodeSchema,
  emailSchema,
  isoDateTimeSchema,
  longTextSchema,
  nonNegativeAmountSchema,
  optionalTextSchema,
  shortTextSchema,
  uuidSchema,
} from './common';

const clientShape = {
  displayName: shortTextSchema.max(160, 'Display name must be 160 characters or fewer.'),
  companyNameOnInvoice: z
    .string()
    .trim()
    .max(160, 'Company name must be 160 characters or fewer.')
    .nullable()
    .optional(),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .max(64, 'Phone number must be 64 characters or fewer.')
    .nullable()
    .optional(),
  billingAddress: addressSchema.nullable().optional(),
  shippingAddress: addressSchema.nullable().optional(),
  taxId: z
    .string()
    .trim()
    .max(128, 'Tax ID must be 128 characters or fewer.')
    .nullable()
    .optional(),
  defaultCurrency: currencyCodeSchema,
  groupId: uuidSchema.nullable().optional(),
  tagIds: z.array(uuidSchema).max(100, 'A client cannot have more than 100 tags.'),
  notes: optionalTextSchema,
};

export const clientCreateSchema = z.object(clientShape).strict();

export const clientUpdateSchema = z.object({ ...clientShape, id: uuidSchema }).strict();

export const clientGroupCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'Group name must be 120 characters or fewer.'),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9A-F]{6}$/iu, 'Enter a valid hexadecimal color.')
      .nullable()
      .optional(),
  })
  .strict();

export const clientGroupUpdateSchema = z
  .object({ ...clientGroupCreateSchema.shape, id: uuidSchema })
  .strict();

export const clientTagCreateSchema = z
  .object({
    name: shortTextSchema.max(120, 'Tag name must be 120 characters or fewer.'),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9A-F]{6}$/iu, 'Enter a valid hexadecimal color.')
      .nullable()
      .optional(),
  })
  .strict();

export const clientTagUpdateSchema = z
  .object({ ...clientTagCreateSchema.shape, id: uuidSchema })
  .strict();

export const clientReminderCreateSchema = z
  .object({
    clientId: uuidSchema,
    assignedToUserId: uuidSchema,
    title: shortTextSchema.max(255, 'Reminder title must be 255 characters or fewer.'),
    dueAt: isoDateTimeSchema,
  })
  .strict();

export const clientReminderUpdateSchema = z
  .object({ ...clientReminderCreateSchema.shape, id: uuidSchema, isCompleted: z.boolean() })
  .strict();

export const clientNoteCreateSchema = z
  .object({
    clientId: uuidSchema,
    body: longTextSchema,
  })
  .strict();

export const clientCreditBalanceAdjustmentSchema = z
  .object({
    clientId: uuidSchema,
    reason: z.enum([
      'overpayment',
      'credit_note_issued',
      'applied_to_invoice',
      'manual_adjustment',
      'refund_issued',
    ]),
    amount: nonNegativeAmountSchema,
    currency: currencyCodeSchema,
    relatedInvoiceId: uuidSchema.nullable().optional(),
    note: optionalTextSchema,
  })
  .strict();

export const clientAccessEmailSchema = z
  .object({
    clientId: uuidSchema,
    email: emailSchema,
  })
  .strict();

export const clientImportRowSchema = z
  .object({
    displayName: shortTextSchema.max(160, 'Display name must be 160 characters or fewer.'),
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .max(64, 'Phone number must be 64 characters or fewer.')
      .nullable()
      .optional(),
    defaultCurrency: currencyCodeSchema,
    billingAddress: addressSchema.nullable().optional(),
  })
  .strict();

export const clientImportSchema = z
  .object({
    rows: z
      .array(clientImportRowSchema)
      .min(1, 'Add at least one client row.')
      .max(10_000, 'Import cannot contain more than 10,000 rows.'),
  })
  .strict();
