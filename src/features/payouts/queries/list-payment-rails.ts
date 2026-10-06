// src/features/payouts/queries/list-payment-rails.ts
// Reading the Adyen and Nium connections one business has, with the state
// each of them is in. References are shown because they are identifiers
// rather than secrets; the keys themselves live in the encrypted vault.

import type { PaymentRailAccount, PaymentRailOverview } from '@/features/payouts/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readEnum, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

const RAILS = ['adyen', 'nium'] as const;
const MODES = ['test', 'live'] as const;
const STATUSES = ['pending', 'onboarding', 'active', 'restricted', 'suspended', 'closed'] as const;

/**
 * Maps one stored rail connection.
 *
 * @param row Row returned by public.payment_rails_for_company.
 * @returns The connection the page renders.
 */
function toAccount(row: DatabaseRow): PaymentRailAccount {
  return {
    id: readString(row, 'id') ?? '',
    rail: readEnum(row, 'rail', RAILS, 'adyen'),
    mode: readEnum(row, 'mode', MODES, 'test'),
    status: readEnum(row, 'status', STATUSES, 'pending'),
    statusNote: readString(row, 'status_note'),
    accountHolderReference: readString(row, 'account_holder_reference'),
    balanceAccountReference: readString(row, 'balance_account_reference'),
    walletReference: readString(row, 'wallet_reference'),
    defaultCurrency: readString(row, 'default_currency') ?? 'USD',
    countryCode: readString(row, 'country_code') ?? 'US',
    platformFeePercentage: readAmount(row, 'platform_fee_percentage'),
    isReceivingEnabled: readBoolean(row, 'is_receiving_enabled'),
    isSendingEnabled: readBoolean(row, 'is_sending_enabled'),
    onboardingUrl: readString(row, 'onboarding_url'),
    lastSyncedAt: readString(row, 'last_synced_at'),
    lastError: readString(row, 'last_error'),
    lastErrorAt: readString(row, 'last_error_at'),
  };
}

/**
 * Reads every global rail connection a business has.
 *
 * @param companyId Company whose connections are read.
 * @returns The connections, and whether the read succeeded.
 */
export async function loadPaymentRails(companyId: string): Promise<PaymentRailOverview> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('payment_rails_for_company', {
    p_company_id: companyId,
  });

  if (error) {
    logger.error('The global payment rails could not be read', error, { companyId });

    return { accounts: [], isDegraded: true };
  }

  return { accounts: asRows(data).map(toAccount), isDegraded: false };
}
