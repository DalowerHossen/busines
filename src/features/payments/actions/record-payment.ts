// src/features/payments/actions/record-payment.ts
// Records money received. The database routine writes the payment, converts
// it to minor units and, when an invoice is named, settles that invoice in the
// same transaction, so a balance can never drift.

'use server';

import { revalidatePath } from 'next/cache';

import { recordPaymentSchema } from '@/features/payments/validation/payment';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RecordPaymentResult {
  /** Identifier of the payment that was recorded. */
  paymentId: string;
}

export const recordPayment = createAction(
  recordPaymentSchema,
  async (input): Promise<RecordPaymentResult> => {
    const { company } = await requirePermission('payments', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('record_payment', {
      p_company_id: company.id,
      p_invoice_id: input.invoiceId,
      p_amount: input.amount,
      p_method: input.methodType,
      p_provider: input.provider,
      p_received_at: `${input.receivedOn}T12:00:00Z`,
      p_reference: input.reference,
      p_gateway_fee: input.gatewayFeeAmount,
    });

    if (error) {
      logger.error('Could not record a payment', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The payment could not be recorded. Check the amount and the invoice, then try again.'
      );
    }

    const paymentId = typeof data === 'string' ? data : null;

    if (paymentId === null) {
      throw new AppError('database_failure', 'The payment was recorded but returned no reference.');
    }

    const details: Record<string, string | null> = {
      payer_name: input.payerName,
      payer_email: input.payerEmail,
      notes: input.notes,
    };

    const hasDetails = Object.values(details).some((value) => value !== null);

    if (hasDetails) {
      const { error: detailError } = await supabase
        .from('payments')
        .update(details)
        .eq('company_id', company.id)
        .eq('id', paymentId);

      if (detailError) {
        logger.error('Could not save the payer details', detailError, { paymentId });
      }
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'payment',
      entityId: paymentId,
      companyId: company.id,
      description: `Payment of ${input.amount} recorded.`,
    });

    revalidatePath('/dashboard/payments');
    revalidatePath('/dashboard/invoices');

    return { paymentId };
  },
  { name: 'recordPayment' }
);
