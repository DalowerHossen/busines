// src/features/estimates/actions/convert-estimate.ts
// Turns an accepted quotation into a draft invoice, copying across every line
// the client chose to keep.

'use server';

import { revalidatePath } from 'next/cache';

import { estimateIdSchema } from '@/features/estimates/validation/estimate';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ConvertEstimateResult {
  /** Identifier of the draft invoice that was created. */
  invoiceId: string;
}

export const convertEstimate = createAction(
  estimateIdSchema,
  async (input): Promise<ConvertEstimateResult> => {
    const { company } = await requirePermission('invoices', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('convert_estimate_to_invoice', {
      p_estimate_id: input.estimateId,
    });

    if (error) {
      logger.error('Could not convert an estimate', error, {
        companyId: company.id,
        estimateId: input.estimateId,
      });

      throw new AppError(
        'conflict',
        'The estimate could not be turned into an invoice. Record the client approval first.'
      );
    }

    const invoiceId = typeof data === 'string' ? data : null;

    if (invoiceId === null) {
      throw new AppError('database_failure', 'The invoice was created but could not be read back.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'invoice',
      entityId: invoiceId,
      companyId: company.id,
      description: 'Draft invoice created from an accepted estimate.',
    });

    revalidatePath('/dashboard/estimates');
    revalidatePath(`/dashboard/estimates/${input.estimateId}`);
    revalidatePath('/dashboard/invoices');

    return { invoiceId };
  },
  { name: 'convertEstimate' }
);
