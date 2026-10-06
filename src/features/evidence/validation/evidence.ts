// src/features/evidence/validation/evidence.ts
// What may be attached to an invoice as proof of the work.

import { z } from 'zod';

import { isoDateSchema, uuidSchema } from '@/lib/validation/primitives';

export const WORK_EVIDENCE_KINDS = ['file', 'link', 'note', 'hours', 'milestone'] as const;

export const addWorkEvidenceSchema = z
  .object({
    invoiceId: uuidSchema,
    kind: z.enum(WORK_EVIDENCE_KINDS),
    title: z
      .string()
      .trim()
      .min(2, 'Say in a few words what this is.')
      .max(160, 'Keep the title under one hundred and sixty characters.'),
    description: z
      .string()
      .trim()
      .max(2000, 'Keep the description under two thousand characters.')
      .optional(),
    fileId: uuidSchema.optional(),
    externalUrl: z
      .string()
      .trim()
      .url('Enter a full web address.')
      .startsWith('https://', 'The address has to be secure, starting with https.')
      .max(500, 'That address is too long.')
      .optional(),
    hoursWorked: z.coerce
      .number()
      .positive('Hours have to be greater than zero.')
      .max(10000, 'That is more hours than a year holds.')
      .optional(),
    performedOn: isoDateSchema.optional(),
    isClientVisible: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.kind === 'file' && value.fileId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fileId'],
        message: 'Choose the file you delivered.',
      });
    }

    if (value.kind === 'link' && value.externalUrl === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['externalUrl'],
        message: 'Enter the address where the work can be seen.',
      });
    }

    if (value.kind === 'hours' && value.hoursWorked === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hoursWorked'],
        message: 'Enter how many hours this covers.',
      });
    }
  });

export type AddWorkEvidenceInput = z.infer<typeof addWorkEvidenceSchema>;

export const removeWorkEvidenceSchema = z.object({
  evidenceId: uuidSchema,
  invoiceId: uuidSchema,
});
