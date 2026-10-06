// src/features/recurring/validation/schedule.ts
// What a valid recurring schedule looks like: a template to copy, a rhythm,
// and an end that either arrives by date or by a count of occurrences.

import { z } from 'zod';

import { isoDateSchema, uuidSchema } from '@/lib/validation/primitives';
import { RECURRENCE_FREQUENCIES, RECURRING_SCHEDULE_STATUSES } from '@/types/enums';

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

const countFromForm = (min: number, max: number, fallback: number) =>
  z
    .union([z.string().trim(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') {
        return fallback;
      }

      const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    })
    .refine((value) => value >= min && value <= max, `Enter a number between ${min} and ${max}.`);

const optionalCount = (min: number, max: number) =>
  z
    .union([z.string().trim(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') {
        return null;
      }

      const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .refine(
      (value) => value === null || (value >= min && value <= max),
      `Enter a number between ${min} and ${max}, or leave it empty.`
    );

export const scheduleBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the schedule a name you will recognise.')
    .max(120, 'Keep the name under 120 characters.'),
  templateInvoiceId: uuidSchema,
  frequency: z.enum(RECURRENCE_FREQUENCIES).default('monthly'),
  intervalCount: countFromForm(1, 52, 1),
  customIntervalDays: optionalCount(1, 365),
  startDate: isoDateSchema,
  endDate: z
    .union([isoDateSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  maxOccurrences: optionalCount(1, 1000),
  paymentTermsDays: countFromForm(0, 365, 30),
  daysBeforeToCreate: countFromForm(0, 30, 0),
  autoIssue: z.boolean().default(true),
  autoSend: z.boolean().default(false),
  notes: optionalText(2000),
});

interface ScheduleRules {
  frequency: (typeof RECURRENCE_FREQUENCIES)[number];
  customIntervalDays: number | null;
  startDate: string;
  endDate: string | null;
}

/**
 * Checks the rules the database enforces on the rhythm and the dates.
 *
 * @param value Parsed schedule values.
 * @param context Refinement context collecting the issues.
 * @returns Nothing.
 */
function checkScheduleRules(value: ScheduleRules, context: z.RefinementCtx): void {
  if (value.frequency === 'custom' && value.customIntervalDays === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customIntervalDays'],
      message: 'Say how many days should pass between invoices.',
    });
  }

  if (value.endDate !== null && value.endDate < value.startDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'The end date cannot fall before the start date.',
    });
  }
}

export const createScheduleSchema = scheduleBaseSchema.superRefine(checkScheduleRules);

export const updateScheduleSchema = scheduleBaseSchema
  .extend({ scheduleId: uuidSchema })
  .superRefine(checkScheduleRules);

export const scheduleIdSchema = z.object({ scheduleId: uuidSchema });

export const setScheduleStatusSchema = z.object({
  scheduleId: uuidSchema,
  status: z.enum(['draft', 'active', 'paused', 'cancelled']),
});

export const scheduleListFiltersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  status: z
    .union([z.enum(RECURRING_SCHEDULE_STATUSES), z.literal('all'), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' || value === 'all' ? null : value)),
  clientId: optionalUuid,
  includeDeleted: z
    .union([z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((value) => value === '1'),
});

export type CreateScheduleInput = z.input<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.input<typeof updateScheduleSchema>;
