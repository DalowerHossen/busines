// src/features/estimates/actions/cancel-estimate.ts
// Withdraws a quotation that will not be pursued, so it can no longer be
// accepted by the client.

'use server';

import { revalidatePath } from 'next/cache';

import { cancelEstimateSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CancelEstimateResult {
  /** Identifier of the estimate that was withdrawn. */
  estimateId: string;
}

export const cancelEstimate = createAction(
  cancelEstimateSchema,
  async (input): Promise<CancelEstimateResult> => {
    const { company } = await requirePermission('estimates', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('cancel_estimate', {
      p_estimate_id: input.estimateId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('Could not withdraw an estimate', error, {
        companyId: company.id,
        estimateId: input.estimateId,
      });

      throw new AppError(
        'conflict',
        'The estimate could not be withdrawn. One that became an invoice stays on record.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'estimate',
      entityId: input.estimateId,
      companyId: company.id,
      description: `Estimate withdrawn: ${input.reason}`,
    });

    revalidatePath('/dashboard/estimates');
    revalidatePath(`/dashboard/estimates/${input.estimateId}`);

    return { estimateId: input.estimateId };
  },
  { name: 'cancelEstimate' }
);
