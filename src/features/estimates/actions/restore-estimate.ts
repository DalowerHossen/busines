// src/features/estimates/actions/restore-estimate.ts
// Brings a deleted draft estimate back into the working lists.

'use server';

import { revalidatePath } from 'next/cache';

import { estimateIdSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RestoreEstimateResult {
  /** Identifier of the estimate that was brought back. */
  estimateId: string;
}

export const restoreEstimate = createAction(
  estimateIdSchema,
  async (input): Promise<RestoreEstimateResult> => {
    const { user, company } = await requirePermission('estimates', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('estimates')
      .update({ deleted_at: null, updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.estimateId)
      .not('deleted_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not restore an estimate', error, { companyId: company.id });

      throw new AppError('database_failure', 'The estimate could not be restored just now.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That estimate is not in the deleted list.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'estimate',
      entityId: input.estimateId,
      companyId: company.id,
      description: 'Deleted estimate restored.',
    });

    revalidatePath('/dashboard/estimates');

    return { estimateId: input.estimateId };
  },
  { name: 'restoreEstimate' }
);
