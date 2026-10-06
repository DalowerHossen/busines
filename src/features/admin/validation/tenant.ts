// src/features/admin/validation/tenant.ts
// What the platform console must supply before a tenant is changed.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';
import { COMPANY_STATUSES } from '@/types/enums';

export const setCompanyStatusSchema = z
  .object({
    companyId: uuidSchema,
    status: z.enum(COMPANY_STATUSES),
    reason: z
      .string()
      .trim()
      .max(300, 'Keep the reason under 300 characters.')
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .refine(
    (value) =>
      !(value.status === 'suspended' || value.status === 'closed') ||
      (value.reason !== null && value.reason.length >= 3),
    { message: 'Give a reason before suspending or closing a tenant.', path: ['reason'] }
  );

export type SetCompanyStatusInput = z.infer<typeof setCompanyStatusSchema>;

export const grantEntitlementSchema = z.object({
  companyId: uuidSchema,
  entitlementKey: z
    .string()
    .trim()
    .regex(
      /^(limits|features)\.[a-z][a-z0-9_]{1,40}$/,
      'Use limits.something or features.something.'
    ),
  /** A number for a limit, or true and false for a module. */
  value: z
    .string()
    .trim()
    .min(1, 'Give the value this tenant should get.')
    .max(40, 'That value is too long.'),
  reason: z
    .string()
    .trim()
    .min(3, 'Say why this tenant is getting an exception.')
    .max(300, 'Keep the reason under 300 characters.'),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type GrantEntitlementInput = z.infer<typeof grantEntitlementSchema>;

export const revokeEntitlementSchema = z.object({
  overrideId: uuidSchema,
  companyId: uuidSchema,
  reason: z
    .string()
    .trim()
    .max(300, 'Keep the reason under 300 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type RevokeEntitlementInput = z.infer<typeof revokeEntitlementSchema>;
