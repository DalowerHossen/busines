// src/features/refunds/actions/review-refund.ts
// Approving or declining a refund that was held back. The person who asked
// for the money is never the person who releases it, which the database
// routine enforces rather than trusting the page to hide a button.

'use server';

import { revalidatePath } from 'next/cache';

import { reviewRefundSchema } from '@/features/refunds/validation/refund';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { reverseSettlementForPayment } from '@/lib/settlements/reverse';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewRefundResult {
  /** The decision that was recorded. */
  decision: 'approved' | 'rejected';
}

export const reviewRefund = createAction(
  reviewRefundSchema,
  async (input): Promise<ReviewRefundResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('review_refund', {
      p_refund_id: input.refundId,
      p_approve: input.approve,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('Could not review a refund', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The decision could not be saved. It may already have been reviewed by somebody else.'
      );
    }

    const decision = data === 'approved' ? 'approved' : 'rejected';

    // Money given back has to leave the wallet it was credited to, or the
    // platform would still owe the seller for a payment that no longer
    // exists.
    if (decision === 'approved') {
      const { data: refundData } = await supabase
        .from('refunds')
        .select('payment_id')
        .eq('id', input.refundId)
        .eq('company_id', company.id)
        .maybeSingle();

      const refund = asRow(refundData);
      const paymentId = refund === null ? null : readString(refund, 'payment_id');

      if (paymentId !== null) {
        await reverseSettlementForPayment(paymentId, 'The payment was refunded', true);
      }
    }

    await recordAuditEntry({
      action: decision === 'approved' ? 'approve' : 'reject',
      entityType: 'refund',
      entityId: input.refundId,
      companyId: company.id,
      description:
        decision === 'approved'
          ? 'Refund approved and paid back.'
          : `Refund declined: ${input.reason ?? 'no reason given'}.`,
    });

    revalidatePath('/dashboard/payments/refunds');
    revalidatePath('/dashboard/payments');
    revalidatePath('/dashboard/invoices');

    return { decision };
  },
  { name: 'reviewRefund' }
);
