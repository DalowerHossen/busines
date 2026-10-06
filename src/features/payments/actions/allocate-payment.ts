// src/features/payments/actions/allocate-payment.ts
// Applies money that is already on record to an invoice. The database routine
// caps the amount at whatever is still unallocated and whatever the invoice
// still owes, so neither side can be overpaid.

'use server';

import { revalidatePath } from 'next/cache';

import { allocatePaymentSchema } from '@/features/payments/validation/payment';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AllocatePaymentResult {
  /** The amount that was applied to the invoice. */
  amount: string;
}

export const allocatePayment = createAction(
  allocatePaymentSchema,
  async (input): Promise<AllocatePaymentResult> => {
    const { company } = await requirePermission('payments', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('allocate_payment_to_invoice', {
      p_payment_id: input.paymentId,
      p_invoice_id: input.invoiceId,
      p_amount: input.amount,
    });

    if (error) {
      logger.error('Could not apply a payment to an invoice', error, {
        companyId: company.id,
        paymentId: input.paymentId,
      });

      throw new AppError(
        'conflict',
        'The payment could not be applied. Check that both are in the same currency and that money is still unallocated.'
      );
    }

    const amount = typeof data === 'number' ? data.toFixed(2) : String(data ?? '0');

    await recordAuditEntry({
      action: 'update',
      entityType: 'payment',
      entityId: input.paymentId,
      companyId: company.id,
      description: `Applied ${amount} to an invoice.`,
    });

    revalidatePath('/dashboard/payments');
    revalidatePath(`/dashboard/payments/${input.paymentId}`);
    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);

    return { amount };
  },
  { name: 'allocatePayment' }
);
