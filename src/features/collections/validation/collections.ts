// src/features/collections/validation/collections.ts
// What may be said about chasing an unpaid invoice.

import { z } from 'zod';

import { moneySchema, timezoneSchema, uuidSchema } from '@/lib/validation/primitives';

export const saveRuleSchema = z.object({
  ruleId: uuidSchema.optional(),
  name: z.string().trim().min(2, 'Name the reminder.').max(80),
  offsetDays: z.coerce
    .number()
    .int()
    .min(-60, 'A reminder more than two months early is not a reminder.')
    .max(180, 'After six months this is a debt, not a reminder.'),
  minimumBalance: moneySchema.default('0'),
  maxReminders: z.coerce
    .number()
    .int()
    .min(1, 'At least one.')
    .max(8, 'More than eight loses the client rather than the money.')
    .default(4),
  skipIfPromiseToPay: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const ruleIdSchema = z.object({
  ruleId: uuidSchema,
});

export const saveSettingsSchema = z
  .object({
    isEnabled: z.boolean(),
    timeZone: timezoneSchema,
    quietHoursStart: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, 'Choose a time.'),
    quietHoursEnd: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, 'Choose a time.'),
    sendingWeekdays: z
      .array(z.coerce.number().int().min(1).max(7))
      .min(1, 'Choose at least one day.'),
    shiftDueDatesToBusinessDays: z.boolean().default(false),
    sendStatements: z.boolean().default(false),
    statementDayOfMonth: z.coerce
      .number()
      .int()
      .min(1)
      .max(28, 'Choose a day every month actually has.')
      .optional(),
  })
  .refine((value) => value.quietHoursStart !== value.quietHoursEnd, {
    path: ['quietHoursEnd'],
    message: 'Quiet hours of zero length are not quiet hours.',
  });

export const recordPromiseSchema = z.object({
  invoiceId: uuidSchema,
  promisedDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the day they said they would pay.'),
  promisedAmount: moneySchema.optional(),
  note: z.string().trim().max(300).optional(),
});
