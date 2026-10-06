import { z } from 'zod';
import { emailSchema, isoDateTimeSchema, shortTextSchema, uuidSchema } from './common';

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long.')
  .max(128, 'Password must be 128 characters or fewer.')
  .refine((value) => /[a-z]/u.test(value), 'Password must contain a lowercase letter.')
  .refine((value) => /[A-Z]/u.test(value), 'Password must contain an uppercase letter.')
  .refine((value) => /[0-9]/u.test(value), 'Password must contain a number.')
  .refine((value) => !/^\s|\s$/u.test(value), 'Password must not start or end with whitespace.');

const passwordConfirmation = {
  confirmPassword: z.string().min(1, 'Confirm your password.'),
};

export const signInSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Enter your password.'),
  })
  .strict();

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    ...passwordConfirmation,
    fullName: shortTextSchema.max(160, 'Full name must be 160 characters or fewer.'),
    companyName: shortTextSchema.max(160, 'Company name must be 160 characters or fewer.'),
    termsVersion: shortTextSchema.max(64, 'Terms version must be 64 characters or fewer.'),
    termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms.' }) }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export const requestPasswordResetSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(32, 'Reset token is invalid.')
      .max(4096, 'Reset token is invalid.'),
    password: passwordSchema,
    ...passwordConfirmation,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export const verifyEmailSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(32, 'Verification token is invalid.')
      .max(4096, 'Verification token is invalid.'),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: passwordSchema,
    ...passwordConfirmation,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password === value.currentPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Choose a different password.',
      });
    }
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export const twoFactorCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/u, 'Enter the six-digit verification code.'),
  })
  .strict();

export const companySwitchSchema = z.object({ companyId: uuidSchema }).strict();

export const teamInviteSchema = z
  .object({
    email: emailSchema,
    role: z.enum(['staff', 'accountant', 'affiliate']),
    permissions: z
      .array(
        z.enum([
          'manage_clients',
          'manage_products',
          'manage_invoices',
          'manage_estimates',
          'manage_expenses',
          'manage_inventory',
          'view_reports',
          'request_send_client_email',
        ])
      )
      .max(32, 'Too many permissions selected.'),
    expiresAt: isoDateTimeSchema.nullable().optional(),
  })
  .strict();

export const acceptTeamInviteSchema = z
  .object({
    inviteToken: z
      .string()
      .trim()
      .min(32, 'Invitation token is invalid.')
      .max(4096, 'Invitation token is invalid.'),
    fullName: shortTextSchema.max(160, 'Full name must be 160 characters or fewer.'),
    password: passwordSchema,
    ...passwordConfirmation,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export const authenticatedSessionSchema = z
  .object({
    userId: uuidSchema,
    email: emailSchema,
    activeCompanyId: uuidSchema.nullable(),
    role: z
      .enum(['super_admin', 'reseller', 'owner', 'staff', 'accountant', 'affiliate'])
      .nullable(),
    expiresAt: isoDateTimeSchema,
  })
  .strict();
