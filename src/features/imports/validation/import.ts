// src/features/imports/validation/import.ts
// What may be handed to an import.

import { z } from 'zod';

export const runImportSchema = z.object({
  importKind: z.enum(['clients', 'products']),
  /** The contents of the file, as text. */
  fileText: z
    .string()
    .min(10, 'That file has nothing in it.')
    .max(2000000, 'That file is too large. Split it and bring it in in parts.'),
  sourceLabel: z.string().trim().max(80).optional(),
  /** True to rehearse without writing anything. */
  isDryRun: z.boolean().default(true),
});
