// src/features/experiments/validation/experiment.ts
// What may be written down about a test.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const saveExperimentSchema = z.object({
  experimentId: uuidSchema.optional(),
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z][a-z0-9_]{2,60}$/,
      'Lower case words joined by underscores, such as hero_wording.'
    ),
  name: z.string().trim().min(2, 'Name the test.').max(80),
  hypothesis: z
    .string()
    .trim()
    .min(10, 'Write what you expect to happen, before you find out. It is the whole point.')
    .max(500),
  goalEventName: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{2,60}$/, 'The event that counts as success, such as signup_started.'),
  trafficPercentage: z.coerce
    .number()
    .int()
    .min(1, 'A test needs at least one percent of visitors.')
    .max(100, 'There are no more visitors than all of them.')
    .default(100),
});

export const saveVariantSchema = z.object({
  experimentId: uuidSchema,
  variantId: uuidSchema.optional(),
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{0,30}$/, 'A short lower case name, such as control or shorter.'),
  name: z.string().trim().min(1, 'Name this side of the test.').max(60),
  weight: z.coerce.number().int().min(1).max(100).default(50),
  isControl: z.boolean().default(false),
});

export const experimentIdSchema = z.object({
  experimentId: uuidSchema,
});

export const concludeExperimentSchema = z.object({
  experimentId: uuidSchema,
  winningVariantId: uuidSchema.optional(),
  conclusion: z
    .string()
    .trim()
    .min(10, 'Write what you decided and why. In three months this is all anybody has.')
    .max(500),
});
