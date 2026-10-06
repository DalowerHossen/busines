// src/features/disputes/actions/assemble-evidence.ts
// Gathering the evidence the platform already holds: the invoice as it was
// issued, when the client opened it, the payment itself, and the proof of
// the delivered work the client saw before they paid.

'use server';

import { revalidatePath } from 'next/cache';

import { disputeIdSchema } from '@/features/disputes/validation/dispute';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AssembleEvidenceResult {
  /** How many pieces of evidence were gathered. */
  itemCount: number;
}

export const assembleEvidence = createAction(
  disputeIdSchema,
  async (input): Promise<AssembleEvidenceResult> => {
    const { company } = await requirePermission('payments', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('assemble_dispute_evidence', {
      p_dispute_id: input.disputeId,
    });

    if (error) {
      logger.error('The evidence could not be gathered', error, { companyId: company.id });

      throw new AppError('database_failure', 'The evidence could not be gathered. Try again.');
    }

    // The delivered work is the strongest material a seller has, and it was
    // sealed the moment the invoice was paid, so it goes in as well.
    const { data: workCount, error: workError } = await supabase.rpc(
      'attach_work_evidence_to_dispute',
      { p_dispute_id: input.disputeId }
    );

    if (workError) {
      logger.warn('The delivered work could not be added to the evidence', {
        disputeId: input.disputeId,
        message: workError.message,
      });
    }

    // The authorisation the payer gave, with the time, address and device it
    // was given from, which is what a card scheme asks for first.
    const { data: consentCount, error: consentError } = await supabase.rpc(
      'attach_consent_to_dispute',
      { p_dispute_id: input.disputeId }
    );

    if (consentError) {
      logger.warn('The payer authorisation could not be added to the evidence', {
        disputeId: input.disputeId,
        message: consentError.message,
      });
    }

    const itemCount =
      (typeof data === 'number' ? data : 0) +
      (typeof workCount === 'number' ? workCount : 0) +
      (typeof consentCount === 'number' ? consentCount : 0);

    await recordAuditEntry({
      action: 'update',
      entityType: 'dispute',
      entityId: input.disputeId,
      companyId: company.id,
      description: `Evidence gathered: ${itemCount} item(s).`,
    });

    revalidatePath(`/dashboard/payments/disputes/${input.disputeId}`);

    return { itemCount };
  },
  { name: 'assembleEvidence' }
);
