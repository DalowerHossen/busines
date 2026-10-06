// src/features/team/validation/team.ts
// What a valid invitation and a valid change of access look like.

import { z } from 'zod';

import { PERMISSION_RESOURCES } from '@/config/permissions';
import { emailSchema, nameSchema, uuidSchema } from '@/lib/validation/primitives';
import { PERMISSION_ACTIONS } from '@/types/enums';

const permissionMapSchema = z
  .record(z.enum(PERMISSION_RESOURCES), z.array(z.enum(PERMISSION_ACTIONS)))
  .default({});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  fullName: nameSchema,
  role: z.enum(['staff', 'accountant']),
  jobTitle: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  message: z
    .string()
    .trim()
    .max(600)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  permissions: permissionMapSchema,
});

export const invitationIdSchema = z.object({ invitationId: uuidSchema });

export const updateMemberAccessSchema = z.object({
  memberId: uuidSchema,
  jobTitle: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  permissions: permissionMapSchema,
});

export const setMemberStatusSchema = z.object({
  memberId: uuidSchema,
  action: z.enum(['suspend', 'reactivate', 'remove']),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type UpdateMemberAccessInput = z.input<typeof updateMemberAccessSchema>;
export type SetMemberStatusInput = z.input<typeof setMemberStatusSchema>;
