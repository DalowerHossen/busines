// src/features/estimates/actions/decline-estimate.ts
// Records that the client turned the quotation down, keeping the reason so the
// sales history explains itself later.

'use server';

import { revalidatePath } from 'next/cache';

import { declineEstimateSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DeclineEstimateResult {
  /** Identifier of the estimate that was turned down. */
  estimateId: string;
}

export const declineEstimate = createAction(
  declineEstimateSchema,
  async (input): Promise<DeclineEstimateResult> => {
    const { company } = await requirePermission('estimates', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('decline_estimate', {
      p_estimate_id: input.estimateId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('Could not decline an estimate', error, {
        companyId: company.id,
        estimateId: input.estimateId,
      });

      throw new AppError(
        'conflict',
        'The decline could not be recorded. This quotation may already be closed.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'estimate',
      entityId: input.estimateId,
      companyId: company.id,
      description: `Estimate declined: ${input.reason}`,
    });

    revalidatePath('/dashboard/estimates');
    revalidatePath(`/dashboard/estimates/${input.estimateId}`);

    return { estimateId: input.estimateId };
  },
  { name: 'declineEstimate' }
);
