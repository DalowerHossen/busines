// src/lib/integrations/resolve.ts
// Getting the live credentials of one integration at the moment they are
// needed.
//
// The order never changes: what an administrator saved in the database wins,
// then the environment variable, then whatever the code was built with. That
// is what lets a key be replaced from the admin panel and work on the next
// request, with no deployment and no restart.
//
// A short cache sits in front of it, keyed on the revision stamp the database
// bumps whenever anything about a connection changes. A change is therefore
// picked up within seconds everywhere, rather than waiting for a cache to
// expire on its own.

import 'server-only';

import { decryptCredentialBundle } from '@/lib/crypto/encryption';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { isJsonObject } from '@/types/json';

/** How long a resolved credential may be reused before it is read again. */
const CACHE_MILLISECONDS = 5000;

export interface ResolvedIntegration {
  credentialId: string | null;
  /** Where it came from: the tenant, the platform or the environment. */
  source: string;
  providerKey: string;
  environment: string;
  isEnabled: boolean;
  status: string;
  /** The usable values, already decrypted and merged with the fallbacks. */
  values: Readonly<Record<string, string>>;
  publicConfig: Readonly<Record<string, string>>;
}

interface CacheEntry {
  revision: number;
  storedAt: number;
  resolved: ResolvedIntegration | null;
}

const cache = new Map<string, CacheEntry>();

/**
 * Reads the revision stamp the database bumps on every credential change.
 *
 * @returns The current revision, or zero when it cannot be read.
 */
async function currentRevision(): Promise<number> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('integration_revision');

  if (error) {
    return 0;
  }

  const row = asRows(data)[0];

  if (row === undefined) {
    return 0;
  }

  const revision = row['revision'];

  return typeof revision === 'number' ? revision : Number(revision ?? 0) || 0;
}

/**
 * Turns a json document into a flat map of strings.
 *
 * @param value The document.
 * @returns Every string value it carries.
 */
function toStringMap(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};

  if (!isJsonObject(value)) {
    return result;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      result[key] = entry;
    } else if (typeof entry === 'number' || typeof entry === 'boolean') {
      result[key] = String(entry);
    }
  }

  return result;
}

/**
 * Resolves one integration for one tenant.
 *
 * @param companyId Tenant asking, or null for a platform level call.
 * @param providerKey Which integration is wanted.
 * @param environment Live or test.
 * @returns The usable credentials, or null when nothing is configured.
 */
export async function resolveIntegration(
  companyId: string | null,
  providerKey: string,
  environment: 'live' | 'test' = 'live'
): Promise<ResolvedIntegration | null> {
  const cacheKey = `${companyId ?? 'platform'}:${providerKey}:${environment}`;
  const cached = cache.get(cacheKey);
  const revision = await currentRevision();

  if (
    cached !== undefined &&
    cached.revision === revision &&
    Date.now() - cached.storedAt < CACHE_MILLISECONDS
  ) {
    return cached.resolved;
  }

  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('resolve_integration', {
    p_company_id: companyId,
    p_provider_key: providerKey,
    p_environment: environment,
  });

  if (error) {
    logger.error('An integration could not be resolved', error, { providerKey });

    return null;
  }

  const row = asRows(data)[0];

  if (row === undefined) {
    cache.set(cacheKey, { revision, storedAt: Date.now(), resolved: null });

    return null;
  }

  const fallback = toStringMap(row['env_fallback']);
  const envelope = readString(row, 'secret_bundle_encrypted');
  const previous = readString(row, 'previous_bundle_encrypted');
  const graceEnds = readString(row, 'previous_bundle_valid_until');

  let stored: Record<string, string> = {};

  if (envelope !== null) {
    try {
      stored = decryptCredentialBundle(envelope);
    } catch (cause) {
      logger.error('A stored credential could not be read', cause, { providerKey });

      // A key that was just rotated may still be in its grace window, which
      // is exactly the case this fallback exists for.
      if (previous !== null && graceEnds !== null && new Date(graceEnds).getTime() > Date.now()) {
        try {
          stored = decryptCredentialBundle(previous);
        } catch {
          stored = {};
        }
      }
    }
  }

  const resolved: ResolvedIntegration = {
    credentialId: readString(row, 'credential_id'),
    source: readString(row, 'source') ?? 'environment',
    providerKey,
    environment,
    isEnabled: readBoolean(row, 'is_enabled'),
    status: readString(row, 'status') ?? 'untested',
    // The environment variable is the floor; what an administrator saved
    // sits on top of it, field by field.
    values: { ...fallback, ...stored },
    publicConfig: toStringMap(row['public_config']),
  };

  cache.set(cacheKey, { revision, storedAt: Date.now(), resolved });

  return resolved;
}

/**
 * Forgets every cached credential at once.
 *
 * Used straight after a save so the person who changed a key sees the effect
 * on their very next request rather than seconds later.
 *
 * @returns Nothing.
 */
export function clearIntegrationCache(): void {
  cache.clear();
}
