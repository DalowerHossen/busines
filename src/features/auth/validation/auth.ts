// src/features/auth/validation/auth.ts
// What every authentication form accepts. The same schema validates the form
// in the browser and the action on the server.

import { z } from 'zod';

import { PLANS } from '@/config/plans';
import {
  booleanFromFormSchema,
  countryCodeSchema,
  emailSchema,
  nameSchema,
  passwordSchema,
} from '@/lib/validation/primitives';

const planKeys = PLANS.map((plan) => plan.key);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(128),
  rememberMe: booleanFromFormSchema.optional().default(false),
  nextPath: z.string().max(512).optional().nullable(),
});

export type SignInInput = z.input<typeof signInSchema>;

export const signUpSchema = z
  .object({
    fullName: nameSchema,
    companyName: z
      .string()
      .trim()
      .min(2, 'Enter the name of your business.')
      .max(120, 'That business name is longer than we can store.'),
    email: emailSchema,
    password: passwordSchema,
    countryCode: countryCodeSchema.optional().default('US'),
    planKey: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && planKeys.includes(value) ? value : 'free')),
    acceptsTerms: z.literal(true, {
      errorMap: () => ({ message: 'Please accept the terms to create an account.' }),
    }),
    marketingOptIn: booleanFromFormSchema.optional().default(false),
    /** Left empty by a person and filled in by a robot. */
    website: z
      .string()
      .max(0, 'This field must stay empty.')
      .optional()
      .transform(() => null),
  })
  .strict();

export type SignUpInput = z.input<typeof signUpSchema>;

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Type the password again.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Both passwords must match.',
  });

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const twoFactorChallengeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, 'Enter the six digit code, or one of your recovery codes.')
    .max(32, 'That code is longer than any code we issue.'),
  nextPath: z.string().max(512).optional().nullable(),
});

export const oauthStartSchema = z.object({
  provider: z.enum(['google', 'github'], {
    errorMap: () => ({ message: 'Choose a sign in provider we support.' }),
  }),
  nextPath: z.string().max(512).optional().nullable(),
});
