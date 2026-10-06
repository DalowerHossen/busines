// src/features/accountants/validation/accountant.ts
// What a valid bookkeeping request looks like: which business, which period,
// and which grant is being changed.

import { z } from 'zod';

import { emailSchema, isoDateSchema, uuidSchema } from '@/lib/validation/primitives';

export const workspaceVisitSchema = z.object({ companyId: uuidSchema });

export const booksPeriodSchema = z
  .object({
    companyId: uuidSchema,
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
  })
  .refine((value) => value.periodStart <= value.periodEnd, {
    message: 'The period has to end on or after it starts.',
    path: ['periodEnd'],
  });

export const grantAccountantAccessSchema = z.object({
  email: emailSchema,
  scopes: z
    .array(z.enum(['accounting', 'reports', 'expenses', 'invoices']))
    .min(1)
    .default(['accounting', 'reports', 'expenses']),
  expiresAt: isoDateSchema.nullable().default(null),
});

export const revokeAccountantAccessSchema = z.object({
  grantId: uuidSchema,
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type WorkspaceVisitInput = z.input<typeof workspaceVisitSchema>;
export type BooksPeriodInput = z.input<typeof booksPeriodSchema>;
export type GrantAccountantAccessInput = z.input<typeof grantAccountantAccessSchema>;
export type RevokeAccountantAccessInput = z.input<typeof revokeAccountantAccessSchema>;
