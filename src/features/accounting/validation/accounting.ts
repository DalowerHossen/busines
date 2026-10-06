// src/features/accounting/validation/accounting.ts
// What may be written into the books by hand.
//
// A journal that does not balance is not a journal, so the rule is checked
// here as well as in the database. Catching it in the form means the person
// is told while they can still see the figures they typed.

import { z } from 'zod';

import { moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;

export const saveAccountSchema = z.object({
  accountId: uuidSchema.optional(),
  code: z
    .string()
    .trim()
    .regex(/^[0-9A-Z.-]{2,20}$/, 'A code is digits or capitals, such as 1200 or BANK-1.'),
  name: z.string().trim().min(2, 'Name the account.').max(120),
  accountType: z.enum(ACCOUNT_TYPES),
  description: z.string().trim().max(300).optional(),
});

const journalLineSchema = z.object({
  accountId: uuidSchema,
  debit: moneySchema.default('0'),
  credit: moneySchema.default('0'),
  description: z.string().trim().max(200).optional(),
});

export const postJournalSchema = z
  .object({
    entryDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date of the entry.'),
    memo: z
      .string()
      .trim()
      .min(3, 'Say what this entry is for. In six months nobody will remember.')
      .max(300),
    reference: z.string().trim().max(60).optional(),
    lines: z.array(journalLineSchema).min(2, 'An entry needs at least two lines.').max(40),
  })
  .superRefine((value, context) => {
    const debit = value.lines.reduce((running, line) => running + Number.parseFloat(line.debit), 0);
    const credit = value.lines.reduce(
      (running, line) => running + Number.parseFloat(line.credit),
      0
    );

    if (debit <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines'],
        message: 'An entry has to move something.',
      });

      return;
    }

    if (Math.abs(debit - credit) > 0.0001) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines'],
        message: `This does not balance. Debits are ${debit.toFixed(2)} and credits are ${credit.toFixed(2)}.`,
      });
    }

    for (const [index, line] of value.lines.entries()) {
      const hasDebit = Number.parseFloat(line.debit) > 0;
      const hasCredit = Number.parseFloat(line.credit) > 0;

      if (hasDebit && hasCredit) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', index],
          message: 'A line is either a debit or a credit, never both.',
        });
      }
    }
  });

export const reverseJournalSchema = z.object({
  entryId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(3, 'Say why it is being reversed. The reversal is permanent.')
    .max(300),
});
