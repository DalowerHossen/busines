// src/features/receipts/validation/receipts.ts
// What the interface will accept when somebody corrects a receipt or turns
// one into an expense.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

const moneyTextSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Give the amount with at most two decimal places.');

export const correctReceiptSchema = z.object({
  scanId: uuidSchema,
  merchantName: z.string().trim().min(2, 'Give the name on the receipt.').max(120).optional(),
  receiptDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Give the date as four digits, two digits, two digits.')
    .optional(),
  receiptNumber: z.string().trim().max(60).optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Use the three letter currency code.')
    .optional(),
  subtotalAmount: moneyTextSchema.optional(),
  taxAmount: moneyTextSchema.optional(),
  totalAmount: moneyTextSchema.optional(),
});

export const acceptReceiptSchema = z.object({
  scanId: uuidSchema,
  categoryId: uuidSchema.optional(),
  vendorId: uuidSchema.optional(),
  description: z.string().trim().min(2).max(300).optional(),
});

export const discardReceiptSchema = z.object({
  scanId: uuidSchema,
  reason: z.string().trim().min(3, 'Say why this receipt is being thrown away.').max(200),
});

export const uploadReceiptSchema = z.object({
  source: z
    .enum(['upload', 'mobile_camera', 'email_inbox', 'api', 'bank_feed_prompt'])
    .default('upload'),
});
