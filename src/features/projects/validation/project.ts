// src/features/projects/validation/project.ts
// What may be typed into a project, a timer or a time entry.

import { z } from 'zod';

import { moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const PROJECT_STATUSES = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
] as const;

export const BILLING_TYPES = [
  'time_and_materials',
  'fixed_price',
  'retainer',
  'non_billable',
] as const;

export const saveProjectSchema = z.object({
  projectId: uuidSchema.optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Name the project.')
    .max(120, 'Keep the name under one hundred and twenty characters.'),
  clientId: uuidSchema.optional(),
  status: z.enum(PROJECT_STATUSES).default('planning'),
  billingType: z.enum(BILLING_TYPES).default('time_and_materials'),
  hourlyRate: moneySchema.optional(),
  fixedPriceAmount: moneySchema.optional(),
  budgetHours: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, 'Enter the hours as a number.')
    .optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const projectIdSchema = z.object({
  projectId: uuidSchema,
});

export const startTimerSchema = z.object({
  projectId: uuidSchema,
  description: z
    .string()
    .trim()
    .min(2, 'Say what you are working on. Future you will want to know.')
    .max(300, 'Keep it under three hundred characters.'),
  isBillable: z.boolean().default(true),
});

export const stopTimerSchema = z.object({
  entryId: uuidSchema,
});

export const logTimeSchema = z.object({
  projectId: uuidSchema,
  minutes: z.coerce
    .number()
    .int()
    .min(1, 'Log at least a minute.')
    .max(1440, 'A single entry cannot be longer than a day.'),
  description: z
    .string()
    .trim()
    .min(2, 'Say what the time was spent on.')
    .max(300, 'Keep it under three hundred characters.'),
  entryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')
    .optional(),
  isBillable: z.boolean().default(true),
});
