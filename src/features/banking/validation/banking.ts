// src/features/banking/validation/banking.ts
// What the interface will accept when somebody settles a statement line or
// changes how a bank feed behaves.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const settleLineSchema = z.object({
  bankTransactionId: uuidSchema,
  recordType: z.enum(['payment', 'expense', 'supplier_bill']),
  recordId: uuidSchema,
  confidence: z.coerce.number().min(0).max(100).default(100),
});

export const ignoreLineSchema = z.object({
  bankTransactionId: uuidSchema,
  reason: z.string().trim().min(3, 'Say why this line is being set aside.').max(200),
});

export const unmatchLineSchema = z.object({
  bankTransactionId: uuidSchema,
  reason: z.string().trim().max(200).optional(),
});

export const linkFeedAccountSchema = z.object({
  feedAccountId: uuidSchema,
  bankAccountId: uuidSchema,
  importFromDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Give the date as four digits, two digits, two digits.')
    .optional(),
});

export const feedFrequencySchema = z.object({
  connectionId: uuidSchema,
  syncFrequencyHours: z.coerce
    .number()
    .int()
    .min(1, 'A feed can be read at most once an hour.')
    .max(168, 'A feed has to be read at least once a week.'),
});

export const disconnectFeedSchema = z.object({
  connectionId: uuidSchema,
  reason: z.string().trim().min(3, 'Say why the connection is being ended.').max(200),
});

export const splitLineSchema = z.object({
  bankTransactionId: uuidSchema,
  parts: z
    .array(
      z.object({
        amount: z.coerce.number().refine((value) => value !== 0, 'A part cannot be nothing.'),
        note: z.string().trim().max(200).optional(),
      })
    )
    .min(2, 'A split needs at least two parts.')
    .max(20, 'A line cannot be split into more than twenty parts.'),
});
