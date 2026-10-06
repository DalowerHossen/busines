// src/features/gateways/actions/test-gateway.ts
// Checking a connection before it is trusted with money. The credentials are
// decrypted for this call only, and the result is stored beside the
// connection so the whole team can see when it was last known to work.

'use server';

import { revalidatePath } from 'next/cache';

import { gatewayIdSchema } from '@/features/gateways/validation/gateway';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { decryptCredentialBundle } from '@/lib/crypto/encryption';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { adapterFor } from '@/lib/payments/adapters/registry';
import { asRow, readEnum, readJson, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GATEWAY_MODES, GATEWAY_PROVIDERS } from '@/types/enums';

export interface TestGatewayResult {
  /** True when the provider answered as expected. */
  isHealthy: boolean;
  /** A sentence the owner can act on. */
  message: string;
}

export const testGateway = createAction(
  gatewayIdSchema,
  async (input): Promise<TestGatewayResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('payment_gateways')
      .select('id, provider, mode, credentials_encrypted, adapter_config')
      .eq('id', input.gatewayId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    const row = asRow(data);

    if (error || row === null) {
      throw new AppError('not_found', 'That connection could not be found.');
    }

    const envelope = readString(row, 'credentials_encrypted');
    let credentials: Record<string, string> = {};

    if (envelope) {
      try {
        credentials = decryptCredentialBundle(envelope);
      } catch (caught) {
        logger.error('Stored gateway credentials could not be read', caught, {
          companyId: company.id,
        });

        throw new AppError(
          'unexpected',
          'The stored credentials could not be read. Save them again.'
        );
      }
    }

    const adapterConfig = readJson(row, 'adapter_config');

    const provider = readEnum(row, 'provider', GATEWAY_PROVIDERS, 'manual');
    const outcome = await adapterFor(provider).testConnection({
      provider,
      mode: readEnum(row, 'mode', GATEWAY_MODES, 'test'),
      credentials,
      adapterConfig,
    });

    await supabase
      .from('payment_gateways')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_succeeded: outcome.isHealthy,
        last_test_message: outcome.message,
      })
      .eq('id', input.gatewayId)
      .eq('company_id', company.id);

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'payment_gateway',
      entityId: input.gatewayId,
      companyId: company.id,
      description: `Connection tested: ${outcome.isHealthy ? 'healthy' : 'not working'}.`,
    });

    revalidatePath('/dashboard/settings/payments');

    return { isHealthy: outcome.isHealthy, message: outcome.message };
  },
  { name: 'testGateway' }
);
