// src/features/integrations/actions/test-connection.ts
// Asking a provider whether the keys we hold actually work.
//
// Nothing is trusted until it has answered once. The credentials are
// decrypted for the length of this call only, the provider is called with a
// short timeout, and the outcome is written beside the connection so the
// whole team can see when it was last known to work and what it said when
// it stopped.

'use server';

import { revalidatePath } from 'next/cache';

import { credentialActionSchema } from '@/features/integrations/validation/integration';
import { createAction } from '@/lib/actions/create-action';
import { requireUser } from '@/lib/auth/guards';
import { decryptCredentialBundle } from '@/lib/crypto/encryption';
import { AppError } from '@/lib/errors';
import { clearIntegrationCache } from '@/lib/integrations/resolve';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** How long a provider is given to answer before the test is called a failure. */
const TIMEOUT_MILLISECONDS = 8000;

export interface TestConnectionResult {
  /** True when the provider answered as expected. */
  isHealthy: boolean;
  /** A sentence the administrator can act on. */
  message: string;
}

/**
 * Picks the header a provider expects its key in.
 *
 * @param values The stored credential values.
 * @returns Headers to send with the test call.
 */
function authorisationHeaders(values: Readonly<Record<string, string>>): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const apiKey = values['api_key'] ?? values['secret_key'] ?? values['access_token'] ?? '';

  if (apiKey !== '') {
    headers['authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  return headers;
}

export const testIntegrationConnection = createAction(
  credentialActionSchema,
  async (input): Promise<TestConnectionResult> => {
    await requireUser();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('integration_credentials')
      .select('id, provider_key, secret_bundle_encrypted')
      .eq('id', input.credentialId)
      .is('deleted_at', null)
      .maybeSingle();

    const credential = asRow(data);

    if (error || credential === null) {
      throw new AppError('not_found', 'That connection could not be found.');
    }

    const providerKey = readString(credential, 'provider_key') ?? '';

    const { data: providerData } = await supabase
      .from('integration_providers')
      .select('test_endpoint, supports_connection_test, name')
      .eq('provider_key', providerKey)
      .maybeSingle();

    const provider = asRow(providerData);
    const endpoint = provider === null ? null : readString(provider, 'test_endpoint');

    if (endpoint === null) {
      // Nothing to call, so the most honest thing is to say the keys are
      // stored and will be judged the first time they are used.
      await supabase.rpc('record_connection_test', {
        p_credential_id: input.credentialId,
        p_succeeded: true,
        p_message: 'Stored. This provider offers no test endpoint, so it is checked in use.',
        p_status_code: null,
        p_duration_ms: 0,
        p_diagnostics: {},
      });

      clearIntegrationCache();
      revalidatePath('/admin/integrations');

      return {
        isHealthy: true,
        message:
          'Keys stored. This provider offers no test call, so it is checked the first time it is used.',
      };
    }

    const envelope = readString(credential, 'secret_bundle_encrypted');
    let values: Record<string, string> = {};

    if (envelope !== null) {
      try {
        values = decryptCredentialBundle(envelope);
      } catch (cause) {
        logger.error('A credential could not be read for testing', cause, { providerKey });

        throw new AppError(
          'integration_failure',
          'The stored keys could not be read. Save them again.'
        );
      }
    }

    const startedAt = Date.now();
    let succeeded = false;
    let statusCode: number | null = null;
    let message = '';

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: authorisationHeaders(values),
        signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS),
      });

      statusCode = response.status;
      succeeded = response.ok;
      message = response.ok
        ? 'The provider answered and accepted these keys.'
        : `The provider refused these keys and answered with ${String(response.status)}.`;
    } catch {
      message = 'The provider could not be reached from this server.';
    }

    await supabase.rpc('record_connection_test', {
      p_credential_id: input.credentialId,
      p_succeeded: succeeded,
      p_message: message,
      p_status_code: statusCode,
      p_duration_ms: Date.now() - startedAt,
      p_diagnostics: {},
    });

    clearIntegrationCache();
    revalidatePath('/admin/integrations');
    revalidatePath('/dashboard/settings/integrations');

    return { isHealthy: succeeded, message };
  },
  { name: 'testIntegrationConnection' }
);
