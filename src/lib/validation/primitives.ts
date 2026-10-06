// src/lib/validation/primitives.ts
// Reusable Zod building blocks. Every server action and API route validates
// its input with these so one rule change applies everywhere.

import { z } from 'zod';

import { isSupportedCurrency } from '@/config/currencies';
import { findCountry } from '@/config/countries';

export const uuidSchema = z.string().uuid('Choose a valid record.');

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Enter an email address.')
  .max(254, 'That email address is too long.')
  .email('Enter a valid email address.')
  .transform((value) => value.toLowerCase());

export const optionalEmailSchema = z
  .union([emailSchema, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Enter a telephone number.')
  .max(32, 'That telephone number is too long.')
  .regex(/^[+]?[0-9()\-.\s]+$/, 'Use digits, spaces and the characters + - ( ) only.');

export const optionalPhoneSchema = z
  .union([phoneSchema, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{6,14}$/, 'Enter the number in international form, such as +14155550142.');

export const shortTextSchema = z.string().trim().min(1, 'This field is required.').max(160);

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter at least two characters.')
  .max(120, 'Use 120 characters or fewer.');

export const longTextSchema = z.string().trim().max(5000, 'Use 5000 characters or fewer.');

export const optionalLongTextSchema = longTextSchema
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and hyphens only.');

export const urlSchema = z.string().trim().url('Enter a full web address including https://');

export const optionalUrlSchema = z
  .union([urlSchema, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const currencyCodeSchema = z
  .string()
  .trim()
  .length(3, 'A currency code has three letters.')
  .transform((value) => value.toUpperCase())
  .refine((value) => isSupportedCurrency(value), 'That currency is not supported yet.');

export const countryCodeSchema = z
  .string()
  .trim()
  .length(2, 'A country code has two letters.')
  .transform((value) => value.toUpperCase())
  .refine((value) => findCountry(value) !== null, 'Choose a country from the list.');

export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date as YYYY-MM-DD.');

export const optionalIsoDateSchema = z
  .union([isoDateSchema, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const timezoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z]+\/[A-Za-z_\-+0-9/]+$|^UTC$/, 'Choose a time zone from the list.');

/** A money amount with at most two decimals, kept as a string. */
export const moneySchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,13}(\.\d{1,2})?$/, 'Enter an amount with up to two decimal places.');

/** A money amount that must be above zero. */
export const positiveMoneySchema = moneySchema.refine(
  (value) => Number.parseFloat(value) > 0,
  'Enter an amount greater than zero.'
);

/** A quantity with up to four decimals, as used on document lines. */
export const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,4})?$/, 'Enter a quantity with up to four decimal places.');

export const percentageSchema = z
  .number()
  .min(0, 'A percentage cannot be negative.')
  .max(100, 'A percentage cannot be above one hundred.');

export const passwordSchema = z
  .string()
  .min(12, 'Use at least twelve characters.')
  .max(128, 'Use 128 characters or fewer.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a digit.');

export const twoFactorCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the six digit code from your authenticator app.');

export const booleanFromFormSchema = z
  .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
  .transform((value) => value === true || value === 'on' || value === 'true');

/**
 * Collects Zod issues into the field error map a form expects.
 *
 * @param error Error produced by a failed parse.
 * @returns Messages grouped by field name.
 */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'form';
    const existing = fieldErrors[key];

    if (existing) {
      existing.push(issue.message);
    } else {
      fieldErrors[key] = [issue.message];
    }
  }

  return fieldErrors;
}
