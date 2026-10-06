// src/features/disputes/actions/submit-evidence.ts
// Sending the evidence file to the provider who raised the chargeback.

'use server';

import { revalidatePath } from 'next/cache';

import { disputeIdSchema } from '@/features/disputes/validation/dispute';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SubmitEvidenceResult {
  /** The state the dispute is now in. */
  status: string;
}

export const submitEvidence = createAction(
  disputeIdSchema,
  async (input): Promise<SubmitEvidenceResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('submit_dispute_evidence', {
      p_dispute_id: input.disputeId,
    });

    if (error) {
      logger.error('The evidence could not be sent', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The evidence could not be sent. Gather at least one item first.'
      );
    }

    await recordAuditEntry({
      action: 'send',
      entityType: 'dispute',
      entityId: input.disputeId,
      companyId: company.id,
      description: 'Evidence sent to the payment provider.',
    });

    revalidatePath(`/dashboard/payments/disputes/${input.disputeId}`);
    revalidatePath('/dashboard/payments/disputes');

    return { status: typeof data === 'string' ? data : 'evidence_submitted' };
  },
  { name: 'submitEvidence' }
);
