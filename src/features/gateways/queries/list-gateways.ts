// src/features/gateways/queries/list-gateways.ts
// Reading the payment connections of one business. Secrets are never read
// back out: only the short hint stored beside them.

import type { GatewayConnection, GatewayOverview } from '@/features/gateways/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readEnum, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { GATEWAY_MODES, GATEWAY_PROVIDERS } from '@/types/enums';

const COLUMNS =
  'id, provider, display_name, mode, is_enabled, is_default, credentials_fingerprint, publishable_key, instructions, supports_payouts, supports_refunds, last_tested_at, last_test_succeeded, last_test_message, last_used_at, last_error_at, last_error_message, fee_percentage, fee_fixed_amount, fee_currency, display_order';

/**
 * Maps one stored connection.
 *
 * @param row Row read from public.payment_gateways.
 * @returns The connection the page renders.
 */
function toConnection(row: DatabaseRow): GatewayConnection {
  const fingerprint = readString(row, 'credentials_fingerprint');

  return {
    id: readString(row, 'id') ?? '',
    provider: readEnum(row, 'provider', GATEWAY_PROVIDERS, 'manual'),
    displayName: readString(row, 'display_name') ?? '',
    mode: readEnum(row, 'mode', GATEWAY_MODES, 'test'),
    isEnabled: readBoolean(row, 'is_enabled'),
    isDefault: readBoolean(row, 'is_default'),
    credentialHint: fingerprint === null ? null : `Ends in ${fingerprint.slice(-6)}`,
    publishableKey: readString(row, 'publishable_key'),
    instructions: readString(row, 'instructions'),
    supportsPayouts: readBoolean(row, 'supports_payouts'),
    supportsRefunds: readBoolean(row, 'supports_refunds'),
    lastTestedAt: readString(row, 'last_tested_at'),
    lastTestSucceeded:
      row['last_test_succeeded'] === null ? null : readBoolean(row, 'last_test_succeeded'),
    lastTestMessage: readString(row, 'last_test_message'),
    lastUsedAt: readString(row, 'last_used_at'),
    lastErrorAt: readString(row, 'last_error_at'),
    lastErrorMessage: readString(row, 'last_error_message'),
    feePercentage: readAmount(row, 'fee_percentage'),
    feeFixedAmount: readAmount(row, 'fee_fixed_amount'),
    feeCurrency: readString(row, 'fee_currency') ?? 'USD',
  };
}

/**
 * Reads every payment connection a business has set up.
 *
 * @param companyId Company whose connections are read.
 * @returns The connections, and whether the read succeeded.
 */
export async function loadGatewayConnections(companyId: string): Promise<GatewayOverview> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('payment_gateways')
    .select(COLUMNS)
    .eq('owner_type', 'company')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
    .order('display_name', { ascending: true });

  if (error) {
    logger.error('Could not read the payment connections', error, { companyId });

    return { connections: [], isDegraded: true };
  }

  return { connections: asRows(data).map(toConnection), isDegraded: false };
}
