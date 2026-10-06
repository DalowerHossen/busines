// src/features/disputes/actions/add-evidence-note.ts
// Adding something the platform cannot know by itself, such as a telephone
// call or a signed delivery sheet. Evidence can never be edited afterwards,
// so each note stands as it was written.

'use server';

import { revalidatePath } from 'next/cache';

import { addEvidenceNoteSchema } from '@/features/disputes/validation/dispute';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AddEvidenceNoteResult {
  /** Identifier of the dispute the note was added to. */
  disputeId: string;
}

export const addEvidenceNote = createAction(
  addEvidenceNoteSchema,
  async (input): Promise<AddEvidenceNoteResult> => {
    const { user, company } = await requirePermission('payments', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: disputeData, error: lookupError } = await supabase
      .from('disputes')
      .select('id')
      .eq('id', input.disputeId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError || disputeData === null) {
      throw new AppError('not_found', 'That dispute could not be found.');
    }

    const { error } = await supabase.from('dispute_evidence_items').insert({
      company_id: company.id,
      dispute_id: input.disputeId,
      evidence_type: 'written_statement',
      title: input.title,
      description: input.detail,
      payload: { statement: input.detail, written_by: user.id },
      collected_by: user.id,
    });

    if (error) {
      logger.error('A piece of evidence could not be added', error, { companyId: company.id });

      throw new AppError('database_failure', 'That note could not be added to the evidence.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'dispute_evidence',
      entityId: input.disputeId,
      companyId: company.id,
      description: `Evidence added: ${input.title}.`,
    });

    revalidatePath(`/dashboard/payments/disputes/${input.disputeId}`);

    return { disputeId: input.disputeId };
  },
  { name: 'addEvidenceNote' }
);
