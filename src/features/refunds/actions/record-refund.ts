// src/features/refunds/actions/record-refund.ts
// Giving money back. The database routine decides whether the amount needs a
// second pair of eyes, and settles it there and then when it does not.

'use server';

import { revalidatePath } from 'next/cache';

import { recordRefundSchema } from '@/features/refunds/validation/refund';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readBoolean } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RecordRefundResult {
  /** Identifier of the refund that was created. */
  refundId: string;
  /** True when the refund is waiting for the owner to approve it. */
  awaitsApproval: boolean;
}

export const recordRefund = createAction(
  recordRefundSchema,
  async (input): Promise<RecordRefundResult> => {
    const { company } = await requirePermission('payments', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('record_refund', {
      p_payment_id: input.paymentId,
      p_amount: input.amount,
      p_reason: input.reason,
      p_provider_reference: null,
    });

    if (error) {
      logger.error('Could not record a refund', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The refund could not be recorded. Check the amount against the payment and try again.'
      );
    }

    const refundId = typeof data === 'string' ? data : null;

    if (refundId === null) {
      throw new AppError('database_failure', 'The refund was created but returned no reference.');
    }

    const { data: storedData } = await supabase
      .from('refunds')
      .select('requires_approval')
      .eq('id', refundId)
      .eq('company_id', company.id)
      .maybeSingle();

    const stored = asRow(storedData);
    const awaitsApproval = stored === null ? false : readBoolean(stored, 'requires_approval');

    await recordAuditEntry({
      action: 'insert',
      entityType: 'refund',
      entityId: refundId,
      companyId: company.id,
      description: awaitsApproval
        ? `Refund of ${input.amount} requested and held for approval.`
        : `Refund of ${input.amount} given back.`,
    });

    revalidatePath('/dashboard/payments');
    revalidatePath('/dashboard/payments/refunds');
    revalidatePath('/dashboard/invoices');

    return { refundId, awaitsApproval };
  },
  { name: 'recordRefund' }
);
