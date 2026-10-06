// src/features/disputes/actions/record-outcome.ts
// Writing down how a chargeback ended. A lost dispute leaves the payment
// charged back, so the invoice stops counting money that went away again.

'use server';

import { revalidatePath } from 'next/cache';

import { recordDisputeOutcomeSchema } from '@/features/disputes/validation/dispute';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { reverseSettlementForPayment } from '@/lib/settlements/reverse';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RecordOutcomeResult {
  /** The outcome that was recorded. */
  status: string;
}

export const recordDisputeOutcome = createAction(
  recordDisputeOutcomeSchema,
  async (input): Promise<RecordOutcomeResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('record_dispute_outcome', {
      p_dispute_id: input.disputeId,
      p_status: input.status,
      p_note: input.note,
      p_recovered_amount: input.recoveredAmount,
    });

    if (error) {
      logger.error('The dispute outcome could not be recorded', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The outcome could not be saved. It may already have been decided.'
      );
    }

    // A dispute decided against the business means the money is gone, so
    // the seller balance has to stop counting it.
    if (input.status === 'lost') {
      const { data: disputeData } = await supabase
        .from('disputes')
        .select('payment_id')
        .eq('id', input.disputeId)
        .eq('company_id', company.id)
        .maybeSingle();

      const dispute = asRow(disputeData);
      const paymentId = dispute === null ? null : readString(dispute, 'payment_id');

      if (paymentId !== null) {
        await reverseSettlementForPayment(paymentId, 'The payer won the dispute');
      }
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'dispute',
      entityId: input.disputeId,
      companyId: company.id,
      description: `Dispute ${input.status}.`,
    });

    revalidatePath(`/dashboard/payments/disputes/${input.disputeId}`);
    revalidatePath('/dashboard/payments/disputes');
    revalidatePath('/dashboard/payments');

    return { status: typeof data === 'string' ? data : input.status };
  },
  { name: 'recordDisputeOutcome' }
);
