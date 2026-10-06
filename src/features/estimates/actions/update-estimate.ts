// src/features/estimates/actions/update-estimate.ts
// Saves a draft estimate. Only a draft can be changed: once a quotation has
// gone out, the client holds a copy, so a change means sending a new one.

'use server';

import { revalidatePath } from 'next/cache';

import { toEstimateItemRows } from '@/features/estimates/actions/line-rows';
import { updateEstimateSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateEstimateResult {
  /** Identifier of the draft that was saved. */
  estimateId: string;
}

export const updateEstimate = createAction(
  updateEstimateSchema,
  async (input): Promise<UpdateEstimateResult> => {
    const { user, company } = await requirePermission('estimates', 'edit');
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
        'This estimate has already gone out, so it can no longer be changed. Send a fresh quotation instead.'
      );
    }

    const { error } = await supabase
      .from('estimates')
      .update({
        client_id: input.clientId,
        title: input.title,
        currency: input.currency,
        issue_date: input.issueDate,
        valid_until: input.validUntil,
        notes: input.notes,
        terms_and_conditions: input.termsAndConditions,
        footer_note: input.footerNote,
        shipping_amount: input.shippingAmount,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.estimateId);

    if (error) {
      logger.error('Could not save a draft estimate', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The estimate could not be saved. Please try again in a moment.'
      );
    }

    const { error: removeError } = await supabase
      .from('estimate_items')
      .delete()
      .eq('company_id', company.id)
      .eq('estimate_id', input.estimateId);

    if (removeError) {
      logger.error('Could not clear the old estimate lines', removeError, {
        estimateId: input.estimateId,
      });

      throw new AppError('database_failure', 'The estimate lines could not be replaced.');
    }

    const { error: lineError } = await supabase
      .from('estimate_items')
      .insert(toEstimateItemRows(input.lines, company.id, input.estimateId, user.id));

    if (lineError) {
      logger.error('Could not save the estimate lines', lineError, {
        estimateId: input.estimateId,
      });

      throw new AppError('database_failure', 'The estimate lines could not be saved.');
    }

    revalidatePath('/dashboard/estimates');
    revalidatePath(`/dashboard/estimates/${input.estimateId}`);

    return { estimateId: input.estimateId };
  },
  { name: 'updateEstimate' }
);
