// src/features/payouts/actions/refresh-payment-rail.ts
// Asking the provider again what state a connection is in, which is what an
// owner wants after they have finished an onboarding form at Adyen or Nium.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { verifyRailConnection } from '@/features/payouts/rail-verification';
import { refreshPaymentRailSchema } from '@/features/payouts/validation/payment-rail';
import { createAction } from '@/lib/actions/create-action';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readEnum, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GATEWAY_MODES } from '@/types/enums';
import type { JsonObject } from '@/types/json';

export interface RefreshPaymentRailResult {
  /** State the provider left the connection in. */
  status: 'onboarding' | 'active';
  /** A sentence the owner can act on. */
  message: string;
}

export const refreshPaymentRail = createAction(
  refreshPaymentRailSchema,
  async (input): Promise<RefreshPaymentRailResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('payment_rail_accounts')
      .select(
        'id, rail, mode, account_holder_reference, balance_account_reference, wallet_reference'
      )
      .eq('id', input.accountId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    const row = asRow(data);

    if (error || row === null) {
      logger.warn('A rail connection could not be read', { companyId: company.id });

      throw new AppError('not_found', 'That connection could not be found.');
    }

    const rail = readEnum(row, 'rail', ['adyen', 'nium'] as const, 'adyen');
    const settings: JsonObject = {
      balance_account_id: readString(row, 'balance_account_reference'),
      account_holder_id: readString(row, 'account_holder_reference'),
      wallet_hash_id: readString(row, 'wallet_reference'),
      customer_hash_id: readString(row, 'account_holder_reference'),
    };

    const verification = await verifyRailConnection(
      company.id,
      input.accountId,
      rail,
      readEnum(row, 'mode', GATEWAY_MODES, 'test'),
      settings
    );

    revalidatePath(`${ROUTES.settings}/payments`);

    return verification;
  },
  { name: 'refreshPaymentRail' }
);
