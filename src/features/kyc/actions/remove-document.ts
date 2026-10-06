// src/features/kyc/actions/remove-document.ts
// Taking a paper back off an identity check that has not been sent yet.

'use server';

import { revalidatePath } from 'next/cache';

import { removeDocumentSchema } from '@/features/kyc/validation/kyc';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RemoveDocumentResult {
  /** Identifier of the paper that was removed. */
  documentId: string;
}

export const removeDocument = createAction(
  removeDocumentSchema,
  async (input): Promise<RemoveDocumentResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('kyc_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.documentId)
      .eq('company_id', company.id);

    if (error) {
      logger.error('A document could not be removed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That document was not removed. Please try again.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'kyc_document',
      entityId: input.documentId,
      companyId: company.id,
      description: 'Identity document removed before submission.',
    });

    revalidatePath('/dashboard/settings/verification');

    return { documentId: input.documentId };
  },
  { name: 'removeDocument' }
);
