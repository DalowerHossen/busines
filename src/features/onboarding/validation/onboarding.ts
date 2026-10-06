// src/features/onboarding/validation/onboarding.ts
// What may be said about a setup suggestion.

import { z } from 'zod';

export const onboardingTaskSchema = z.object({
  taskKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{2,40}$/, 'That is not a setup step we know about.'),
});
