// src/features/payments/actions/delete-payment.ts
// Removes a payment that was entered by hand and has not been applied to
// anything. Money that came through a gateway, or that is already settling an
// invoice, is never deleted: the allocation is reversed instead.

'use server';

import { revalidatePath } from 'next/cache';

import { paymentIdSchema } from '@/features/payments/validation/payment';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readAmount, readBoolean } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DeletePaymentResult {
  /** Identifier of the payment that was removed. */
  paymentId: string;
}

export const deletePayment = createAction(
  paymentIdSchema,
  async (input): Promise<DeletePaymentResult> => {
    const { user, company } = await requirePermission('payments', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('payments')
      .select('id, is_manual, allocated_amount, refunded_amount')
      .eq('company_id', company.id)
      .eq('id', input.paymentId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That payment no longer exists.');
    }

    if (!readBoolean(current, 'is_manual')) {
      throw new AppError(
        'conflict',
        'This payment came through a gateway, so it stays on record. Refund it instead.'
      );
    }

    if (Number.parseFloat(readAmount(current, 'allocated_amount')) > 0) {
      throw new AppError(
        'conflict',
        'This payment is settling an invoice. Reverse the allocation first, then delete it.'
      );
    }

    const { error } = await supabase
      .from('payments')
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.paymentId);

    if (error) {
      logger.error('Could not delete a payment', error, { companyId: company.id });

      throw new AppError('database_failure', 'The payment could not be removed just now.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'payment',
      entityId: input.paymentId,
      companyId: company.id,
      description: 'Manual payment deleted.',
    });

    revalidatePath('/dashboard/payments');

    return { paymentId: input.paymentId };
  },
  { name: 'deletePayment' }
);
