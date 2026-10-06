// src/features/portal/validation/document-link.ts
// Shared validation for document links. Keeping schemas outside the server
// action module lets Next.js treat the action module's exports correctly.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const createDocumentLinkSchema = z.object({
  documentKind: z.enum(['invoice', 'estimate']),
  documentId: uuidSchema,
  recipientEmail: z
    .string()
    .trim()
    .email()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});
