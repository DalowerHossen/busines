// src/features/estimates/actions/create-estimate.ts
// Creates a draft estimate with its lines. A draft carries no number: the
// number is assigned when the quotation is sent, so a draft that never leaves
// the office cannot leave a gap in the sequence.

'use server';

import { revalidatePath } from 'next/cache';

import { toEstimateItemRows } from '@/features/estimates/actions/line-rows';
import { createEstimateSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CreateEstimateResult {
  /** Identifier of the draft that was created. */
  estimateId: string;
}

export const createEstimate = createAction(
  createEstimateSchema,
  async (input): Promise<CreateEstimateResult> => {
    const { user, company } = await requirePermission('estimates', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('estimates')
      .insert({
        company_id: company.id,
        client_id: input.clientId,
        title: input.title,
        currency: input.currency,
        base_currency: company.baseCurrency,
        issue_date: input.issueDate,
        valid_until: input.validUntil,
        notes: input.notes,
        terms_and_conditions: input.termsAndConditions,
        footer_note: input.footerNote,
        shipping_amount: input.shippingAmount,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Could not create a draft estimate', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The estimate could not be saved. Please try again in a moment.'
      );
    }

    const estimateId = readString(asRow(data) ?? {}, 'id');

    if (estimateId === null) {
      throw new AppError('database_failure', 'The estimate was saved but could not be read back.');
    }

    const { error: lineError } = await supabase
      .from('estimate_items')
      .insert(toEstimateItemRows(input.lines, company.id, estimateId, user.id));

    if (lineError) {
      logger.error('Could not save the estimate lines', lineError, { estimateId });

      throw new AppError(
        'database_failure',
        'The estimate was created but its lines could not be saved. Open the draft and try again.'
      );
    }

    revalidatePath('/dashboard/estimates');

    return { estimateId };
  },
  { name: 'createEstimate' }
);
