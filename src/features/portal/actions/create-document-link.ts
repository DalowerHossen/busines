// src/features/portal/actions/create-document-link.ts
// Creating the link a client opens. Only the owner may put a document in
// front of a client, and only the hash of the token is kept, so the link can
// never be recovered from the database.

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { issueDocumentLink } from '@/features/portal/services/issue-document-link';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { createServerSupabaseClient } from '@/lib/supabase/server';
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

export interface CreateDocumentLinkResult {
  /** Identifier of the stored link. */
  linkId: string;
  /** Path the client has to open, relative to the application. */
  linkPath: string;
  /** When the link stops working. */
  expiresAt: string;
  /** True when the client is asked for an emailed code first. */
  requiresEmailOtp: boolean;
}

export const createDocumentLink = createAction(
  createDocumentLinkSchema,
  async (input): Promise<CreateDocumentLinkResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const link = await issueDocumentLink(createServerSupabaseClient(), {
      companyId: company.id,
      documentKind: input.documentKind,
      documentId: input.documentId,
      recipientEmail: input.recipientEmail,
      createdBy: user.id,
    });

    await recordAuditEntry({
      action: 'send',
      entityType: `${input.documentKind}_link`,
      entityId: input.documentId,
      companyId: company.id,
      description: 'A client link was created for this document.',
    });

    revalidatePath(`/dashboard/${input.documentKind}s/${input.documentId}`);

    return {
      linkId: link.linkId,
      linkPath: link.linkPath,
      expiresAt: link.expiresAt,
      requiresEmailOtp: link.requiresEmailOtp,
    };
  },
  { name: 'createDocumentLink' }
);
