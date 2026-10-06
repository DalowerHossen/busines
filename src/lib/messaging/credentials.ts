// src/lib/messaging/credentials.ts
// Finding the credentials a channel sends with. The vault comes first, so a
// business can change a key from the settings screen and have it take effect
// on the next message; the environment is only a fallback for a self hosted
// installation that has not filled the vault in yet.

import 'server-only';

import { decryptCredentialBundle } from '@/lib/crypto/encryption';
import { logger } from '@/lib/logger';
import { asRow, readJson, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { JsonObject } from '@/types/json';

export interface ResolvedChannelCredentials {
  /** The secrets themselves, in clear text, for this call only. */
  credentials: Record<string, string>;
  /** Endpoints and field names stored beside the secrets. */
  settings: JsonObject;
  /** Where the values came from, which is worth knowing when nothing works. */
  source: 'vault' | 'environment' | 'none';
}

/**
 * Reads one environment value without letting an empty string through.
 *
 * @param key Name of the variable.
 * @returns The value, or null when it is not set.
 */
function fromEnvironment(key: string): string | null {
  const value = process.env[key];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Collects whatever the environment holds for one provider.
 *
 * @param provider Provider key stored with the channel.
 * @returns The credentials found, which may be empty.
 */
function environmentCredentials(provider: string): Record<string, string> {
  const prefix = `MESSAGING_${provider.toUpperCase()}`;
  const found: Record<string, string> = {};

  for (const field of ['API_KEY', 'AUTH_TOKEN', 'ACCOUNT_ID', 'BOT_TOKEN'] as const) {
    const value = fromEnvironment(`${prefix}_${field}`);

    if (value !== null) {
      found[field.toLowerCase()] = value;
    }
  }

  return found;
}

/**
 * Resolves the credentials and settings one channel should send with.
 *
 * @param credentialId Vault entry recorded on the channel, when there is one.
 * @param provider Provider key stored with the channel.
 * @returns The credentials, the settings and where they came from.
 */
export async function resolveChannelCredentials(
  credentialId: string | null,
  provider: string
): Promise<ResolvedChannelCredentials> {
  if (credentialId) {
    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from('integration_credentials')
      .select('secret_bundle_encrypted, public_config, is_enabled')
      .eq('id', credentialId)
      .is('deleted_at', null)
      .maybeSingle();

    const row = asRow(data);

    if (!error && row !== null) {
      const envelope = readString(row, 'secret_bundle_encrypted');
      const settings = readJson(row, 'public_config');

      if (envelope) {
        try {
          return {
            credentials: decryptCredentialBundle(envelope),
            settings,
            source: 'vault',
          };
        } catch (caught) {
          logger.error('Stored messaging credentials could not be read', caught, {
            credentialId,
          });
        }
      }
    }
  }

  const fallback = environmentCredentials(provider);

  return {
    credentials: fallback,
    settings: {},
    source: Object.keys(fallback).length > 0 ? 'environment' : 'none',
  };
}
