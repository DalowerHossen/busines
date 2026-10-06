import Decimal from 'decimal.js';
import { z } from 'zod';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,8})?$/u;
const NON_NEGATIVE_DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,8})?$/u;

export const uuidSchema = z.string().trim().regex(UUID_PATTERN, 'Enter a valid identifier.');

export const isoDateTimeSchema = z
  .string()
  .trim()
  .datetime({ offset: true, message: 'Enter a valid UTC date and time.' });

export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(320, 'Email address must be 320 characters or fewer.')
  .transform((value) => value.toLowerCase());

export const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/u, 'Enter a valid three-letter currency code.')
  .transform((value) => value.toUpperCase());

export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/u, 'Enter a valid two-letter country code.')
  .transform((value) => value.toUpperCase());

export const decimalAmountSchema = z
  .string()
  .trim()
  .regex(DECIMAL_PATTERN, 'Enter a decimal amount with up to eight decimal places.');

export const nonNegativeAmountSchema = z
  .string()
  .trim()
  .regex(
    NON_NEGATIVE_DECIMAL_PATTERN,
    'Enter a non-negative decimal amount with up to eight decimal places.'
  );

export const positiveAmountSchema = nonNegativeAmountSchema.refine(
  (value) => new Decimal(value).gt(0),
  'Amount must be greater than zero.'
);

export const percentageSchema = nonNegativeAmountSchema.refine(
  (value) => new Decimal(value).lte(100),
  'Percentage cannot exceed 100.'
);

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16, 'Idempotency key must be at least 16 characters long.')
  .max(255, 'Idempotency key must be 255 characters or fewer.')
  .regex(/^[A-Za-z0-9._:-]+$/u, 'Idempotency key contains invalid characters.');

export const urlSchema = z
  .string()
  .trim()
  .url('Enter a valid URL.')
  .max(2_048, 'URL must be 2,048 characters or fewer.');

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'Slug is required.')
  .max(160, 'Slug must be 160 characters or fewer.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
    'Slug may contain lowercase letters, numbers, and hyphens.'
  );

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-F]{6}$/iu, 'Enter a valid hexadecimal color.');

export const mimeTypeSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/iu, 'Enter a valid MIME type.')
  .max(127, 'MIME type must be 127 characters or fewer.');

export const shortTextSchema = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(255, 'This field must be 255 characters or fewer.');

export const longTextSchema = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(10_000, 'This field must be 10,000 characters or fewer.');

export const optionalTextSchema = z
  .string()
  .trim()
  .max(10_000, 'This field must be 10,000 characters or fewer.')
  .nullable()
  .optional();

export const addressSchema = z
  .object({
    line1: shortTextSchema.max(255, 'Address line must be 255 characters or fewer.'),
    line2: z.string().trim().max(255, 'Address line must be 255 characters or fewer.').nullable(),
    city: shortTextSchema.max(120, 'City must be 120 characters or fewer.'),
    state: z
      .string()
      .trim()
      .max(120, 'State or region must be 120 characters or fewer.')
      .nullable(),
    postalCode: z.string().trim().max(32, 'Postal code must be 32 characters or fewer.').nullable(),
    country: countryCodeSchema,
  })
  .strict();

export const moneySchema = z
  .object({
    amount: nonNegativeAmountSchema,
    currency: currencyCodeSchema,
  })
  .strict();

export const pageRequestSchema = z
  .object({
    page: z.number().int().min(1, 'Page must be at least 1.').max(100_000, 'Page is too large.'),
    pageSize: z
      .number()
      .int()
      .min(1, 'Page size must be at least 1.')
      .max(100, 'Page size must be 100 or fewer.'),
    sortBy: z
      .string()
      .trim()
      .regex(/^[a-z][a-zA-Z0-9_]*$/u, 'Sort field is invalid.')
      .max(64, 'Sort field must be 64 characters or fewer.')
      .optional(),
    sortDirection: z.enum(['asc', 'desc']).optional(),
  })
  .strict();

export const ipAddressSchema = z
  .string()
  .trim()
  .ip({ version: 'v4', message: 'Enter a valid IP address.' })
  .or(z.string().trim().ip({ version: 'v6', message: 'Enter a valid IP address.' }));

export function dateOrderSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  earlierField: keyof z.objectUtil.addQuestionMarks<z.baseObjectOutputType<T>> & string,
  laterField: keyof z.objectUtil.addQuestionMarks<z.baseObjectOutputType<T>> & string,
  message: string
): z.ZodEffects<z.ZodObject<T>> {
  return schema.superRefine((value, context) => {
    const earlier = value[earlierField];
    const later = value[laterField];
    if (
      typeof earlier === 'string' &&
      typeof later === 'string' &&
      Date.parse(later) < Date.parse(earlier)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [laterField], message });
    }
  });
}
