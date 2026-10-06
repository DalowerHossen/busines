// src/features/messaging/validation/messaging.ts
// What a valid send looks like before anything leaves the building.

import { z } from 'zod';

import { emailSchema, uuidSchema } from '@/lib/validation/primitives';

export const sendDocumentSchema = z.object({
  documentKind: z.enum(['invoice', 'estimate']),
  documentId: uuidSchema,
  recipientEmail: emailSchema,
  recipientName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  templateKey: z.enum(['invoice_sent', 'invoice_reminder', 'invoice_overdue', 'estimate_sent']),
  customMessage: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const reviewSendRequestSchema = z.object({
  requestId: uuidSchema,
  approve: z.boolean(),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const sendRemindersSchema = z.object({
  invoiceIds: z.array(uuidSchema).min(1, 'Choose at least one invoice.').max(200),
  templateKey: z.enum(['invoice_reminder', 'invoice_overdue']),
});

export type SendDocumentInput = z.input<typeof sendDocumentSchema>;
export type ReviewSendRequestInput = z.input<typeof reviewSendRequestSchema>;
export type SendRemindersInput = z.input<typeof sendRemindersSchema>;
