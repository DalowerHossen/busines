// src/features/integrations/queries/list-integrations.ts
// Everything this platform, or one tenant, can be connected to.

import type { IntegrationField, IntegrationSummary } from '@/features/integrations/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface IntegrationBoard {
  integrations: readonly IntegrationSummary[];
  /** True when the list could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the connections and the form each provider needs.
 *
 * @param companyId Tenant being configured, or null for the platform itself.
 * @returns The connections and whether the read failed.
 */
export async function loadIntegrations(companyId: string | null): Promise<IntegrationBoard> {
  const supabase = createServerSupabaseClient();

  const [overview, providers] = await Promise.all([
    supabase.rpc('integration_overview', { p_company_id: companyId }),
    supabase
      .from('integration_providers')
      .select('provider_key, field_schema')
      .eq('is_active', true),
  ]);

  if (overview.error) {
    logger.error('The connections could not be read', overview.error, { companyId });

    return { integrations: [], isDegraded: true };
  }

  const schemas = new Map<string, readonly IntegrationField[]>();

  for (const row of asRows(providers.data)) {
    const key = readString(row, 'provider_key') ?? '';
    const schema = row['field_schema'];

    if (!Array.isArray(schema)) {
      continue;
    }

    schemas.set(
      key,
      schema.flatMap((entry) => {
        if (!isJsonObject(entry)) {
          return [];
        }

        const type = typeof entry['type'] === 'string' ? entry['type'] : 'text';

        return [
          {
            key: typeof entry['key'] === 'string' ? entry['key'] : '',
            label: typeof entry['label'] === 'string' ? entry['label'] : '',
            type,
            isRequired: entry['required'] === true,
            isSecret: entry['secret'] === true || type === 'secret' || type === 'password',
            envVar: typeof entry['env_var'] === 'string' ? entry['env_var'] : null,
          },
        ];
      })
    );
  }

  return {
    integrations: asRows(overview.data).map((row) => {
      const hints = row['masked_hints'];
      const maskedHints: Record<string, string> = {};

      if (isJsonObject(hints)) {
        for (const [key, value] of Object.entries(hints)) {
          if (typeof value === 'string') {
            maskedHints[key] = value;
          }
        }
      }

      const providerKey = readString(row, 'provider_key') ?? '';

      return {
        providerKey,
        name: readString(row, 'name') ?? '',
        category: readString(row, 'category') ?? 'other',
        summary: readString(row, 'summary') ?? '',
        configurableBy: readString(row, 'configurable_by') ?? 'platform',
        documentationUrl: readString(row, 'documentation_url'),
        logoSlug: readString(row, 'logo_slug'),
        credentialId: readString(row, 'credential_id'),
        scope: readString(row, 'scope'),
        environment: readString(row, 'environment') ?? 'live',
        isEnabled: readBoolean(row, 'is_enabled'),
        status: readString(row, 'status') ?? 'not_configured',
        maskedHints,
        lastTestedAt: readString(row, 'last_tested_at'),
        lastTestSucceeded:
          row['last_test_succeeded'] === null ? null : readBoolean(row, 'last_test_succeeded'),
        lastUsedAt: readString(row, 'last_used_at'),
        lastError: readString(row, 'last_error'),
        lastErrorAt: readString(row, 'last_error_at'),
        fields: schemas.get(providerKey) ?? [],
      };
    }),
    isDegraded: false,
  };
}
