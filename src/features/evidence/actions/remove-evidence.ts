// src/features/evidence/actions/remove-evidence.ts
// Taking a piece of proof back off an invoice.
//
// Only possible while the invoice is still open. Once the client has paid,
// what they saw is sealed, because evidence that can be edited afterwards is
// worth nothing in a dispute.

'use server';

import { revalidatePath } from 'next/cache';

import { removeWorkEvidenceSchema } from '@/features/evidence/validation/evidence';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RemoveWorkEvidenceResult {
  /** True when the proof was removed. */
  isRemoved: boolean;
}

export const removeWorkEvidence = createAction(
  removeWorkEvidenceSchema,
  async (input): Promise<RemoveWorkEvidenceResult> => {
    const { company } = await requirePermission('invoices', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('remove_work_evidence', {
      p_evidence_id: input.evidenceId,
    });

    if (error) {
      logger.error('Proof of work could not be removed', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That proof could not be removed. It may have been sealed when the invoice was paid.'
      );
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'invoice_work_evidence',
      entityId: input.evidenceId,
      companyId: company.id,
      description: 'Removed a piece of proof from an invoice.',
    });

    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);

    return { isRemoved: data === true };
  },
  { name: 'removeWorkEvidence' }
);
