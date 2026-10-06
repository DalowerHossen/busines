// src/features/invoices/validation/invoice.ts
// What a valid invoice looks like before it reaches the database: at least one
// line, a client, dates that make sense and money with two decimal places.

import { z } from 'zod';

import { isoDateSchema, moneySchema, uuidSchema } from '@/lib/validation/primitives';
import { INVOICE_STATUSES } from '@/types/enums';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const optionalUuid = z
  .union([uuidSchema, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d{1,11}(\.\d{1,3})?$/, 'Enter a quantity with up to three decimal places.')
  .refine((value) => Number.parseFloat(value) > 0, 'A line needs a quantity above zero.');

const percentageTextSchema = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,4})?$/, 'Enter a percentage with up to four decimal places.')
      .refine(
        (value) => Number.parseFloat(value) <= 100,
        'A percentage cannot be above one hundred.'
      ),
    z.literal(''),
  ])
  .optional()
  .transform((value) => (value === undefined || value === '' ? '0' : value));

export const invoiceLineSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Describe what this line is for.')
    .max(500, 'Keep the line description under 500 characters.'),
  quantity: quantitySchema,
  unitPrice: moneySchema.refine(
    (value) => Number.parseFloat(value) >= 0,
    'A price cannot be negative.'
  ),
  unitLabel: optionalText(40),
  discountValue: z
    .union([moneySchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? '0' : value)),
  taxPercentage: percentageTextSchema,
  productId: optionalUuid,
  taxRateId: optionalUuid,
});

export const invoiceBaseSchema = z.object({
  clientId: uuidSchema,
  currency: z
    .string()
    .trim()
    .length(3, 'A currency code has three letters.')
    .transform((value) => value.toUpperCase()),
  issueDate: isoDateSchema,
  dueDate: isoDateSchema,
  purchaseOrderReference: optionalText(80),
  notes: optionalText(2000),
  termsAndConditions: optionalText(4000),
  footerNote: optionalText(500),
  internalMemo: optionalText(2000),
  shippingAmount: z
    .union([moneySchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? '0' : value)),
  lines: z.array(invoiceLineSchema).min(1, 'An invoice needs at least one line.').max(200),
});

interface InvoiceDateRules {
  issueDate: string;
  dueDate: string;
}

/**
 * Checks the rules the database enforces on the dates.
 *
 * @param value Parsed invoice values.
 * @param context Refinement context collecting the issue.
 * @returns Nothing.
 */
function checkInvoiceDates(value: InvoiceDateRules, context: z.RefinementCtx): void {
  if (value.dueDate < value.issueDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dueDate'],
      message: 'The due date cannot fall before the issue date.',
    });
  }
}

export const createInvoiceSchema = invoiceBaseSchema.superRefine(checkInvoiceDates);

export const updateInvoiceSchema = invoiceBaseSchema
  .extend({ invoiceId: uuidSchema })
  .superRefine(checkInvoiceDates);

export const invoiceIdSchema = z.object({ invoiceId: uuidSchema });

export const issueInvoiceSchema = z.object({
  invoiceId: uuidSchema,
  issueDate: isoDateSchema.optional(),
});

export const cancelInvoiceSchema = z.object({
  invoiceId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(3, 'Give a short reason so the audit trail explains itself.')
    .max(300, 'Keep the reason under 300 characters.'),
});

export const invoiceListFiltersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  status: z
    .union([z.enum(INVOICE_STATUSES), z.literal('all'), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' || value === 'all' ? null : value)),
  clientId: optionalUuid,
  fromDate: z
    .union([isoDateSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  toDate: z
    .union([isoDateSchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  includeDeleted: z
    .union([z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((value) => value === '1'),
});

export type InvoiceLineInput = z.input<typeof invoiceLineSchema>;
export type InvoiceLineValues = z.infer<typeof invoiceLineSchema>;
export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.input<typeof updateInvoiceSchema>;
