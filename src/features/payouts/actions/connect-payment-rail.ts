// src/features/payouts/actions/connect-payment-rail.ts
// Connecting this business to Adyen or Nium.
//
// The owner supplies the identifiers the provider issued during onboarding.
// They are saved, the provider is asked whether the account is really usable,
// and only the provider can move the connection to active.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { verifyRailConnection } from '@/features/payouts/rail-verification';
import { connectPaymentRailSchema } from '@/features/payouts/validation/payment-rail';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { JsonObject } from '@/types/json';

export interface ConnectPaymentRailResult {
  /** Identifier of the connection that now exists. */
  accountId: string;
  /** State the provider left the connection in. */
  status: 'onboarding' | 'active';
  /** A sentence the owner can act on. */
  message: string;
}

export const connectPaymentRail = createAction(
  connectPaymentRailSchema,
  async (input): Promise<ConnectPaymentRailResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('link_payment_rail_account', {
      p_company_id: company.id,
      p_rail: input.rail,
      p_mode: input.mode,
      p_account_holder_reference: input.accountHolderReference,
      p_balance_account_reference: input.balanceAccountReference,
      p_wallet_reference: input.walletReference,
      p_default_currency: input.defaultCurrency,
      p_country_code: input.countryCode,
      p_platform_fee_percentage: input.platformFeePercentage,
    });

    if (error) {
      logger.error('The payment rail could not be connected', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The connection could not be saved. Please try again.'
      );
    }

    const accountId = typeof data === 'string' ? data : '';

    if (accountId.length === 0) {
      throw new AppError('unexpected', 'The connection could not be saved. Please try again.');
    }

    const settings: JsonObject = {
      balance_account_id: input.balanceAccountReference,
      account_holder_id: input.accountHolderReference,
      wallet_hash_id: input.walletReference,
      customer_hash_id: input.accountHolderReference,
    };

    const verification = await verifyRailConnection(
      company.id,
      accountId,
      input.rail,
      input.mode,
      settings
    );

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'payment_rail_account',
      entityId: accountId,
      companyId: company.id,
      description: `${input.rail === 'adyen' ? 'Adyen' : 'Nium'} connection saved in ${input.mode} mode.`,
      metadata: { rail: input.rail, mode: input.mode, status: verification.status },
    });

    revalidatePath(`${ROUTES.settings}/payments`);

    return { accountId, status: verification.status, message: verification.message };
  },
  { name: 'connectPaymentRail' }
);
