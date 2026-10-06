// src/features/purchasing/validation/purchasing.ts
// What may be said about a supplier, a bill or an order.

import { z } from 'zod';

import {
  countryCodeSchema,
  emailSchema,
  moneySchema,
  nameSchema,
  uuidSchema,
} from '@/lib/validation/primitives';

export const saveSupplierSchema = z.object({
  vendorId: uuidSchema.optional(),
  displayName: nameSchema,
  legalName: z.string().trim().max(160).optional(),
  email: emailSchema.optional(),
  phone: z.string().trim().max(40).optional(),
  countryCode: countryCodeSchema.optional(),
  taxNumber: z.string().trim().max(40).optional(),
  paymentTermsDays: z.coerce
    .number()
    .int()
    .min(0, 'Terms cannot be negative.')
    .max(365, 'Terms longer than a year are not terms.')
    .default(30),
});

export const saveBillSchema = z.object({
  billId: uuidSchema.optional(),
  vendorId: uuidSchema,
  vendorInvoiceNumber: z
    .string()
    .trim()
    .min(1, 'Put the number the supplier used on their own invoice.')
    .max(60),
  billDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date on the bill.'),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose when it has to be paid.'),
  totalAmount: moneySchema.refine(
    (value) => Number.parseFloat(value) > 0,
    'A bill has to be worth something.'
  ),
  taxAmount: moneySchema.default('0'),
  notes: z.string().trim().max(500).optional(),
});

export const billIdSchema = z.object({
  billId: uuidSchema,
});

export const recordBillPaymentSchema = z.object({
  billId: uuidSchema,
  amount: moneySchema.refine(
    (value) => Number.parseFloat(value) > 0,
    'Enter what you actually paid.'
  ),
  paidOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date you paid it.')
    .optional(),
});
