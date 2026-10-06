// src/features/integrations/validation/integration.ts
// What may be said when a connection is configured.
//
// The values themselves are not described field by field, because each
// provider declares its own form in the catalogue. What is enforced here is
// the shape: a known provider, a known environment, and a flat map of
// strings that is small enough to be a credential rather than a payload.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

const providerKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{2,40}$/, 'That is not a provider we know about.');

export const saveIntegrationSchema = z.object({
  providerKey: providerKeySchema,
  environment: z.enum(['live', 'test']),
  /** Null configures the platform connection rather than one tenant. */
  isPlatformScope: z.boolean().default(false),
  label: z.string().trim().max(60).optional(),
  values: z
    .record(z.string().trim().max(2000))
    .refine((entries) => Object.keys(entries).length <= 20, 'That is too many fields.'),
});

export type SaveIntegrationInput = z.infer<typeof saveIntegrationSchema>;

export const credentialActionSchema = z.object({
  credentialId: uuidSchema,
  reason: z.string().trim().max(200).optional(),
});

export const rotateIntegrationSchema = z.object({
  credentialId: uuidSchema,
  providerKey: providerKeySchema,
  values: z.record(z.string().trim().max(2000)),
  graceMinutes: z.coerce.number().int().min(1).max(60).default(5),
});
