// src/features/estimates/actions/send-estimate.ts
// Sends a quotation out. The database assigns the number and freezes the
// client identity onto the document, so what the client holds and what the
// company keeps can never drift apart.

'use server';

import { revalidatePath } from 'next/cache';

import { sendEstimateSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SendEstimateResult {
  /** The number the estimate was given. */
  estimateNumber: string;
}

export const sendEstimate = createAction(
  sendEstimateSchema,
  async (input): Promise<SendEstimateResult> => {
    const { company } = await requirePermission('estimates', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('issue_estimate', {
      p_estimate_id: input.estimateId,
      ...(input.issueDate === undefined ? {} : { p_issue_date: input.issueDate }),
    });

    if (error) {
      logger.error('Could not send an estimate', error, {
        companyId: company.id,
        estimateId: input.estimateId,
      });

      throw new AppError(
        'conflict',
        'The estimate could not be sent. Check that it has at least one line and has not gone out already.'
      );
    }

    const estimateNumber = typeof data === 'string' ? data : null;

    if (estimateNumber === null) {
      throw new AppError('database_failure', 'The estimate was sent but returned no number.');
    }

    await recordAuditEntry({
      action: 'approve',
      entityType: 'estimate',
      entityId: input.estimateId,
      companyId: company.id,
      description: `Estimate ${estimateNumber} sent to the client.`,
    });

    revalidatePath('/dashboard/estimates');
    revalidatePath(`/dashboard/estimates/${input.estimateId}`);

    return { estimateNumber };
  },
  { name: 'sendEstimate' }
);
