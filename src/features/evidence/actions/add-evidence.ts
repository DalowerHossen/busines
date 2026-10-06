// src/features/evidence/actions/add-evidence.ts
// Attaching proof of the delivered work to an invoice.
//
// For a freelancer invoicing across a border this is the difference between
// being paid and being argued with: the client sees the delivered files, the
// link and the hours on the same page as the pay button.

'use server';

import { revalidatePath } from 'next/cache';

import { addWorkEvidenceSchema } from '@/features/evidence/validation/evidence';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AddWorkEvidenceResult {
  /** Identifier of the proof that was attached. */
  evidenceId: string;
}

export const addWorkEvidence = createAction(
  addWorkEvidenceSchema,
  async (input): Promise<AddWorkEvidenceResult> => {
    const { company } = await requirePermission('invoices', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('add_work_evidence', {
      p_invoice_id: input.invoiceId,
      p_kind: input.kind,
      p_title: input.title,
      p_description: input.description ?? null,
      p_file_id: input.fileId ?? null,
      p_external_url: input.externalUrl ?? null,
      p_hours_worked: input.hoursWorked ?? null,
      p_performed_on: input.performedOn ?? null,
      p_is_client_visible: input.isClientVisible,
    });

    if (error) {
      logger.error('Proof of work could not be attached', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That proof could not be attached. The invoice may already be closed.'
      );
    }

    const evidenceId = typeof data === 'string' ? data : null;

    if (evidenceId === null) {
      throw new AppError('database_failure', 'The proof was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'invoice_work_evidence',
      entityId: evidenceId,
      companyId: company.id,
      description: `Attached proof of work to an invoice: ${input.title}.`,
      metadata: { kind: input.kind, is_client_visible: input.isClientVisible },
    });

    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);

    return { evidenceId };
  },
  { name: 'addWorkEvidence' }
);
