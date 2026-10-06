// src/features/integrations/actions/save-credential.ts
// Saving the keys of one integration from the admin panel.
//
// The secret is encrypted before it leaves this process and is never read
// back to anybody: what the screen shows afterwards is a hint, the last few
// characters, which is enough to tell two keys apart and useless to anyone
// who sees it. Saving also resets the connection to untested, because a key
// nobody has tried is not a working connection.

'use server';

import { revalidatePath } from 'next/cache';

import { saveIntegrationSchema } from '@/features/integrations/validation/integration';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin, requireTenant } from '@/lib/auth/guards';
import { encryptCredentialBundle } from '@/lib/crypto/encryption';
import { secretHint, sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { clearIntegrationCache } from '@/lib/integrations/resolve';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { JsonObject } from '@/types/json';

export interface SaveIntegrationResult {
  /** Identifier of the stored connection. */
  credentialId: string;
}

export const saveIntegrationCredential = createAction(
  saveIntegrationSchema,
  async (input): Promise<SaveIntegrationResult> => {
    // A platform connection is the platform team's business; a tenant one
    // belongs to whoever runs that business.
    const companyId = input.isPlatformScope
      ? null
      : await requireTenant().then((context) => context.company.id);

    if (input.isPlatformScope) {
      await requireSuperAdmin();
    }

    const supabase = createServerSupabaseClient();

    const { data: fieldData, error: fieldError } = await supabase.rpc('integration_fields', {
      p_provider_key: input.providerKey,
    });

    if (fieldError) {
      throw new AppError('not_found', 'That integration is not one we know about.');
    }

    const fields = Array.isArray(fieldData) ? fieldData : [];
    const secretKeys = new Set<string>();
    const publicConfig: JsonObject = {};

    for (const field of fields) {
      if (typeof field !== 'object' || field === null) {
        continue;
      }

      const record = field as Record<string, unknown>;
      const key = typeof record['field_key'] === 'string' ? record['field_key'] : '';

      if (key === '') {
        continue;
      }

      if (record['is_secret'] === true) {
        secretKeys.add(key);
      } else {
        const value = input.values[key];

        if (typeof value === 'string' && value !== '') {
          publicConfig[key] = value;
        }
      }
    }

    const bundle: Record<string, string> = {};
    const hints: JsonObject = {};

    for (const [key, value] of Object.entries(input.values)) {
      if (value === '') {
        continue;
      }

      bundle[key] = value;
      hints[key] = secretKeys.has(key) ? secretHint(value) : value;
    }

    if (Object.keys(bundle).length === 0) {
      throw new AppError('validation_failed', 'Fill in at least one field before saving.');
    }

    const { data, error } = await supabase.rpc('save_integration_credential', {
      p_company_id: companyId,
      p_provider_key: input.providerKey,
      p_environment: input.environment,
      p_secret_bundle_encrypted: encryptCredentialBundle(bundle),
      p_bundle_fingerprint: sha256Hex(JSON.stringify(bundle)),
      p_masked_hints: hints,
      p_public_config: publicConfig,
      p_label: input.label ?? null,
      p_key_version: 1,
    });

    if (error) {
      logger.error('An integration credential could not be saved', error, {
        provider: input.providerKey,
      });

      throw new AppError('database_failure', 'Those keys could not be saved. Try again.');
    }

    const credentialId = typeof data === 'string' ? data : null;

    if (credentialId === null) {
      throw new AppError('database_failure', 'The keys were saved but returned no reference.');
    }

    // Every server in this deployment reads the revision stamp, so the new
    // key is live within seconds; clearing here makes it immediate for the
    // person who just typed it.
    clearIntegrationCache();

    await recordAuditEntry({
      action: 'secret_change',
      entityType: 'integration_credential',
      entityId: credentialId,
      companyId,
      description: `Keys saved for ${input.providerKey} in the ${input.environment} environment.`,
      metadata: { provider: input.providerKey, environment: input.environment },
    });

    revalidatePath('/admin/integrations');
    revalidatePath('/dashboard/settings/integrations');

    return { credentialId };
  },
  { name: 'saveIntegrationCredential' }
);
