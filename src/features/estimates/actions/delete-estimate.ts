// src/features/estimates/actions/delete-estimate.ts
// Removes a draft quotation from the lists. One that has gone out is withdrawn
// instead, so the numbering stays unbroken.

'use server';

import { revalidatePath } from 'next/cache';

import { estimateIdSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DeleteEstimateResult {
  /** Identifier of the estimate that was removed. */
  estimateId: string;
}

export const deleteEstimate = createAction(
  estimateIdSchema,
  async (input): Promise<DeleteEstimateResult> => {
    const { user, company } = await requirePermission('estimates', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('estimates')
      .select('id, status')
      .eq('company_id', company.id)
      .eq('id', input.estimateId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That estimate no longer exists.');
    }

    if (readString(current, 'status') !== 'draft') {
      throw new AppError(
        'conflict',
        'A quotation that has gone out cannot be deleted, because the numbering has to stay unbroken. Withdraw it instead.'
      );
    }

    const { error } = await supabase
      .from('estimates')
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.estimateId);

    if (error) {
      logger.error('Could not delete a draft estimate', error, { companyId: company.id });

      throw new AppError('database_failure', 'The draft could not be removed just now.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'estimate',
      entityId: input.estimateId,
      companyId: company.id,
      description: 'Draft estimate deleted.',
    });

    revalidatePath('/dashboard/estimates');

    return { estimateId: input.estimateId };
  },
  { name: 'deleteEstimate' }
);
