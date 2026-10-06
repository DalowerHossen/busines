// src/features/estimates/actions/approve-estimate.ts
// Records that the client accepted the quotation, which is the point at which
// it can become an invoice.

'use server';

import { revalidatePath } from 'next/cache';

import { approveEstimateSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ApproveEstimateResult {
  /** Identifier of the estimate that was accepted. */
  estimateId: string;
}

export const approveEstimate = createAction(
  approveEstimateSchema,
  async (input): Promise<ApproveEstimateResult> => {
    const { company } = await requirePermission('estimates', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('approve_estimate', {
      p_estimate_id: input.estimateId,
      p_approved_by_name: input.approvedByName,
    });

    if (error) {
      logger.error('Could not approve an estimate', error, {
        companyId: company.id,
        estimateId: input.estimateId,
      });

      throw new AppError(
        'conflict',
        'The approval could not be recorded. Only a quotation that has gone out can be accepted.'
      );
    }

    await recordAuditEntry({
      action: 'approve',
      entityType: 'estimate',
      entityId: input.estimateId,
      companyId: company.id,
      description:
        input.approvedByName === null
          ? 'Estimate accepted by the client.'
          : `Estimate accepted by ${input.approvedByName}.`,
    });

    revalidatePath('/dashboard/estimates');
    revalidatePath(`/dashboard/estimates/${input.estimateId}`);

    return { estimateId: input.estimateId };
  },
  { name: 'approveEstimate' }
);
