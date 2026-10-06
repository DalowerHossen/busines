// src/features/disputes/validation/dispute.ts
// What the dispute actions must be given.

import { z } from 'zod';

import { moneySchema, uuidSchema } from '@/lib/validation/primitives';

export const disputeIdSchema = z.object({ disputeId: uuidSchema });

export const recordDisputeOutcomeSchema = z.object({
  disputeId: uuidSchema,
  status: z.enum(['won', 'lost', 'withdrawn']),
  note: z
    .string()
    .trim()
    .max(600, 'Keep the note under 600 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  recoveredAmount: z
    .union([moneySchema, z.literal('')])
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
});

export const addEvidenceNoteSchema = z.object({
  disputeId: uuidSchema,
  title: z
    .string()
    .trim()
    .min(2, 'Give this piece of evidence a title.')
    .max(160, 'Keep the title under 160 characters.'),
  detail: z
    .string()
    .trim()
    .min(4, 'Write down what this evidence shows.')
    .max(2000, 'Keep it under 2000 characters.'),
});

export type RecordDisputeOutcomeInput = z.input<typeof recordDisputeOutcomeSchema>;
export type AddEvidenceNoteInput = z.input<typeof addEvidenceNoteSchema>;
