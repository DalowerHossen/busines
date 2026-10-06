// src/features/settings/validation/settings.ts
// What valid settings look like. The rules mirror the ones the database
// enforces, so a mistake is caught in the form rather than at the last
// moment.

import { z } from 'zod';

import { emailSchema, isoDateSchema, urlSchema } from '@/lib/validation/primitives';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalEmail = z
  .union([emailSchema, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const optionalUrl = z
  .union([urlSchema, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const hexColour = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six digit colour such as #1D4ED8.');

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

const optionalMoney = z
  .union([z.string().trim(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') {
      return null;
    }

    return typeof value === 'number' ? value.toFixed(2) : value;
  })
  .refine(
    (value) => value === null || /^\d{1,13}(\.\d{1,2})?$/.test(value),
    'Enter an amount with up to two decimal places, or leave it empty.'
  );

export const companyProfileSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(2, 'Enter the registered name of the business.')
    .max(200, 'Keep the name under 200 characters.'),
  tradeName: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
  supportEmail: optionalEmail,
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(80),
  stateRegion: optionalText(80),
  postalCode: optionalText(24),
  countryCode: z.string().trim().toUpperCase().length(2, 'A country code has two letters.'),
  taxId: optionalText(60),
  vatNumber: optionalText(60),
  registrationNumber: optionalText(60),
  taxRegistrationLabel: z
    .string()
    .trim()
    .min(2, 'Say what this number is called where you trade.')
    .max(40, 'Keep the label under 40 characters.'),
  bankName: optionalText(120),
  bankAccountName: optionalText(120),
  bankAccountNumber: optionalText(60),
  bankRoutingNumber: optionalText(40),
  bankSwiftCode: optionalText(20),
  bankIban: optionalText(40),
  remitToInstructions: optionalText(600),
});

export const invoiceDefaultsSchema = z.object({
  invoicePrefix: z.string().trim().max(16, 'Keep the prefix under 16 characters.'),
  estimatePrefix: z.string().trim().max(16, 'Keep the prefix under 16 characters.'),
  receiptPrefix: z.string().trim().max(16, 'Keep the prefix under 16 characters.'),
  numberPadding: countFromForm(0, 12, 4),
  numberingResetPolicy: z.enum(['never', 'yearly', 'monthly']).default('never'),
  defaultPaymentTermsDays: countFromForm(0, 365, 30),
  defaultNotes: optionalText(2000),
  defaultTerms: optionalText(4000),
  defaultFooterText: optionalText(600),
  brandPrimaryColor: hexColour,
  brandAccentColor: hexColour,
  invoiceTemplateKey: z.enum(['classic', 'modern', 'minimal', 'compact']).default('classic'),
  paperSize: z.enum(['a4', 'letter']).default('letter'),
  showPlatformBadge: z.boolean().default(true),
});

export const securityPolicySchema = z.object({
  requireTwoFactor: z.boolean().default(false),
  requireTwoFactorForOwner: z.boolean().default(true),
  sessionTimeoutMinutes: countFromForm(5, 43200, 480),
  passwordMinLength: countFromForm(8, 64, 10),
  requireEmailOtpForLinks: z.boolean().default(false),
  documentLinkTtlDays: countFromForm(1, 365, 30),
  requireApprovalForRefunds: z.boolean().default(false),
  staffSingleActionCap: optionalMoney,
  staffDailyCap: optionalMoney,
});

/** Kept so a future export job can be asked for a date range. */
export const settingsPeriodSchema = z.object({ asOf: isoDateSchema });

export type CompanyProfileInput = z.input<typeof companyProfileSchema>;
export type InvoiceDefaultsInput = z.input<typeof invoiceDefaultsSchema>;
export type SecurityPolicyInput = z.input<typeof securityPolicySchema>;
