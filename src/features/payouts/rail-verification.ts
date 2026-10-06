// src/features/payouts/rail-verification.ts
// Asking Adyen or Nium whether a connected account is really ready.
//
// The answer is written back by the service role, because what a provider
// said is a fact about the outside world and not something a person should
// be able to type into a form.

import 'server-only';

import { decryptCredentialBundle } from '@/lib/crypto/encryption';
import { logger } from '@/lib/logger';
import { payoutRailFor } from '@/lib/payouts/rails/registry';
import { asRow, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { GatewayMode } from '@/types/enums';
import type { JsonObject } from '@/types/json';

export interface RailVerification {
  /** State the account was moved to. */
  status: 'onboarding' | 'active';
  /** A sentence the owner can act on. */
  message: string;
}

/**
 * Reads the saved keys for one rail, if the business has connected it.
 *
 * @param companyId Company the keys belong to.
 * @param rail Rail the keys are for.
 * @param mode Whether the test or the live keys are wanted.
 * @returns The credentials, or an empty set when none are saved.
 */
async function loadRailCredentials(
  companyId: string,
  rail: 'adyen' | 'nium',
  mode: GatewayMode
): Promise<Record<string, string>> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('payment_gateways')
    .select('credentials_encrypted')
    .eq('company_id', companyId)
    .eq('provider', rail)
    .eq('mode', mode)
    .is('deleted_at', null)
    .maybeSingle();

  const row = asRow(data);

  if (error || row === null) {
    return {};
  }

  const envelope = readString(row, 'credentials_encrypted');

  if (envelope === null) {
    return {};
  }

  try {
    return decryptCredentialBundle(envelope);
  } catch (caught) {
    logger.error('Stored rail credentials could not be read', caught, { companyId, rail });

    return {};
  }
}

/**
 * Checks one rail connection against the provider and records the answer.
 *
 * @param companyId Company the connection belongs to.
 * @param accountId Connection being checked.
 * @param rail Rail the connection uses.
 * @param mode Whether the connection is in test or live mode.
 * @param settings Identifiers saved beside the connection.
 * @returns What the provider said, and the state that was stored.
 */
export async function verifyRailConnection(
  companyId: string,
  accountId: string,
  rail: 'adyen' | 'nium',
  mode: GatewayMode,
  settings: JsonObject
): Promise<RailVerification> {
  const credentials = await loadRailCredentials(companyId, rail, mode);
  const service = getServiceSupabaseClient();

  if (Object.keys(credentials).length === 0) {
    const message = `Save the ${rail === 'adyen' ? 'Adyen' : 'Nium'} keys on the payment settings page first.`;

    await service.rpc('record_payment_rail_error', {
      p_account_id: accountId,
      p_message: message,
    });

    return { status: 'onboarding', message };
  }

  const outcome = await payoutRailFor(rail).verify({ rail, mode, credentials, settings });

  if (!outcome.isAccepted) {
    await service.rpc('record_payment_rail_error', {
      p_account_id: accountId,
      p_message: outcome.message,
    });

    return { status: 'onboarding', message: outcome.message };
  }

  const { error } = await service.rpc('sync_payment_rail_account', {
    p_account_id: accountId,
    p_status: 'active',
    p_capabilities: { verified_against: outcome.providerStatus ?? 'reachable' },
    p_is_receiving_enabled: rail === 'adyen',
    p_is_sending_enabled: true,
  });

  if (error) {
    logger.error('The rail state could not be written', error, { companyId, accountId });

    return {
      status: 'onboarding',
      message: 'The provider answered, but the state could not be saved.',
    };
  }

  return { status: 'active', message: outcome.message };
}
