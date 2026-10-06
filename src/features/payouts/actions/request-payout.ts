// src/features/payouts/actions/request-payout.ts
// Asking for the balance to be sent out. The database routine checks the
// threshold and the available balance and reserves the amount, so the same
// money can never be requested twice.

'use server';

import { revalidatePath } from 'next/cache';

import { requestPayoutSchema } from '@/features/payouts/validation/payout';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RequestPayoutResult {
  /** Identifier of the payout that was requested. */
  payoutId: string;
}

export const requestPayout = createAction(
  requestPayoutSchema,
  async (input): Promise<RequestPayoutResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: walletData } = await supabase
      .from('wallets')
      .select('id')
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    const wallet = asRow(walletData);

    if (wallet === null) {
      throw new AppError('not_found', 'This business has no wallet to pay out from.');
    }

    const { data, error } = await supabase.rpc('request_payout', {
      p_wallet_id: readString(wallet, 'id'),
      p_amount: input.amount,
      p_payout_account_id: input.accountId,
    });

    if (error) {
      logger.error('A payout could not be requested', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The payout could not be requested. Check the amount against your available balance.'
      );
    }

    const payoutId = typeof data === 'string' ? data : null;

    if (payoutId === null) {
      throw new AppError('database_failure', 'The payout was requested but returned no reference.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'payout',
      entityId: payoutId,
      companyId: company.id,
      description: `Payout of ${input.amount} requested.`,
    });

    revalidatePath('/dashboard/payouts');

    return { payoutId };
  },
  { name: 'requestPayout' }
);
