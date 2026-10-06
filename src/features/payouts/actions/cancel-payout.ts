// src/features/payouts/actions/cancel-payout.ts
// Calling off a payout that has not been sent yet. The reserved amount goes
// straight back to the available balance.

'use server';

import { revalidatePath } from 'next/cache';

import { cancelPayoutSchema } from '@/features/payouts/validation/payout';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CancelPayoutResult {
  /** Identifier of the payout that was called off. */
  payoutId: string;
}

export const cancelPayout = createAction(
  cancelPayoutSchema,
  async (input): Promise<CancelPayoutResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('cancel_payout', {
      p_payout_id: input.payoutId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A payout could not be called off', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'This payout could not be called off. It may already be on its way.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'payout',
      entityId: input.payoutId,
      companyId: company.id,
      description: 'Payout called off and the money returned to the wallet.',
    });

    revalidatePath('/dashboard/payouts');

    return { payoutId: input.payoutId };
  },
  { name: 'cancelPayout' }
);
