// src/features/timesheets/validation/timesheet.ts
// What may be said about a week of work, or a retainer.

import { z } from 'zod';

import { moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const buildTimesheetSchema = z.object({
  periodStart: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the Monday the week starts on.'),
});

export const timesheetIdSchema = z.object({
  timesheetId: uuidSchema,
});

export const reviewTimesheetSchema = z
  .object({
    timesheetId: uuidSchema,
    approve: z.boolean(),
    reason: z.string().trim().max(300).optional(),
  })
  .superRefine((value, context) => {
    if (!value.approve && (value.reason === undefined || value.reason.length < 3)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Say why it is being sent back. The person has to know what to fix.',
      });
    }
  });

export const saveRetainerSchema = z.object({
  agreementId: uuidSchema.optional(),
  clientId: uuidSchema,
  projectId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Name the retainer.').max(120),
  amount: moneySchema,
  includedHours: z
    .string()
    .trim()
    .regex(/^\d{1,5}(\.\d{1,2})?$/, 'Enter the included hours as a number.'),
  overageHourlyRate: moneySchema.optional(),
  billingPeriod: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).default('monthly'),
  rolloverUnusedHours: z.boolean().default(false),
});

export const retainerIdSchema = z.object({
  agreementId: uuidSchema,
});

export const periodIdSchema = z.object({
  periodId: uuidSchema,
});
