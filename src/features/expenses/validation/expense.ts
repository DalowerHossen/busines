// src/features/expenses/validation/expense.ts
// What a valid expense claim looks like: a date, a description, an amount,
// and the extra facts needed when it is recharged or reimbursed.

import { z } from 'zod';

import { isoDateSchema, moneySchema, uuidSchema } from '@/lib/validation/primitives';
import { EXPENSE_STATUSES, PAYMENT_METHOD_TYPES } from '@/types/enums';

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

const currencyChoice = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, 'A currency code has three letters.');

/** A markup percentage typed into the form, kept as text so nothing is rounded. */
const markupSchema = z
  .union([z.string().trim(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') {
      return '0';
    }

    return typeof value === 'number' ? value.toString() : value;
  })
  .refine((value) => /^\d{1,4}(\.\d{1,4})?$/.test(value), 'Enter a markup between 0 and 1000.')
  .refine((value) => Number.parseFloat(value) <= 1000, 'Enter a markup between 0 and 1000.');

export const expenseBaseSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, 'Say what the money was spent on.')
    .max(300, 'Keep the description under 300 characters.'),
  expenseDate: isoDateSchema,
  vendorId: optionalUuid,
  categoryId: optionalUuid,
  reference: optionalText(80),
  currency: currencyChoice,
  subtotalAmount: moneySchema,
  taxAmount: moneySchema.optional().default('0'),
  taxRateId: optionalUuid,
  paymentMethod: z
    .union([z.enum(PAYMENT_METHOD_TYPES), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  isPaid: z.boolean().default(false),
  isBillable: z.boolean().default(false),
  clientId: optionalUuid,
  markupPercentage: markupSchema,
  isReimbursable: z.boolean().default(false),
  notes: optionalText(2000),
});

interface ExpenseRules {
  isBillable: boolean;
  clientId: string | null;
}

/**
 * Checks the rules the database enforces on a claim.
 *
 * @param value Parsed expense values.
 * @param context Refinement context collecting the issues.
 * @returns Nothing.
 */
function checkExpenseRules(value: ExpenseRules, context: z.RefinementCtx): void {
  if (value.isBillable && value.clientId === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['clientId'],
      message: 'Choose the client this spending is recharged to.',
    });
  }
}

export const createExpenseSchema = expenseBaseSchema.superRefine(checkExpenseRules);

export const updateExpenseSchema = expenseBaseSchema
  .extend({ expenseId: uuidSchema })
  .superRefine(checkExpenseRules);

export const expenseIdSchema = z.object({ expenseId: uuidSchema });

export const reviewExpenseSchema = z
  .object({
    expenseId: uuidSchema,
    approve: z.boolean(),
    reason: optionalText(500),
  })
  .superRefine((value, context) => {
    if (!value.approve && value.reason === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Please say why the claim is being sent back.',
      });
    }
  });

export const settleExpenseSchema = z.object({
  expenseId: uuidSchema,
  paidOn: isoDateSchema,
  paymentMethod: z
    .union([z.enum(PAYMENT_METHOD_TYPES), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
});

export const expenseListFiltersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  status: z
    .union([z.enum(EXPENSE_STATUSES), z.literal('all'), z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' || value === 'all' ? null : value)),
  vendorId: optionalUuid,
  categoryId: optionalUuid,
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

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
