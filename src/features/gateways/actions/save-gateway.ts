// src/features/gateways/actions/save-gateway.ts
// Saving a payment connection. Credentials are encrypted before they leave
// the server, the previous ones stay valid for a few minutes so a payment in
// flight is not dropped, and nothing secret is ever returned to the browser.

'use server';

import { revalidatePath } from 'next/cache';

import { gatewayDefinition } from '@/features/gateways/catalog';
import { saveGatewaySchema } from '@/features/gateways/validation/gateway';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { encryptCredentialBundle } from '@/lib/crypto/encryption';
import { sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

/** How long a rotated out secret keeps working. */
const GRACE_MINUTES = 5;

export interface SaveGatewayResult {
  /** Identifier of the stored connection. */
  gatewayId: string;
}

export const saveGateway = createAction(
  saveGatewaySchema,
  async (input): Promise<SaveGatewayResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const definition = gatewayDefinition(input.provider);
    const supabase = createServerSupabaseClient();

    const provided = Object.entries(input.credentials).filter(
      ([, value]) => value.trim().length > 0
    );

    const missing = definition.fields
      .filter((field) => field.isRequired)
      .filter((field) => !provided.some(([key]) => key === field.key))
      .map((field) => field.label);

    const isNewConnection = input.gatewayId === undefined;

    if (isNewConnection && missing.length > 0) {
      throw new AppError(
        'validation_failed',
        `These are still needed before the connection can be saved: ${missing.join(', ')}.`
      );
    }

    const adapterConfigValue: unknown = JSON.parse(input.adapterConfig);
    const adapterConfig =
      typeof adapterConfigValue === 'object' &&
      adapterConfigValue !== null &&
      !Array.isArray(adapterConfigValue)
        ? (adapterConfigValue as Record<string, Json>)
        : {};

    if (input.provider === 'custom' && Object.keys(adapterConfig).length === 0) {
      throw new AppError(
        'validation_failed',
        'A provider of your own needs its configuration, so we know which address to call.'
      );
    }

    const changes: Record<string, Json> = {
      owner_type: 'company',
      company_id: company.id,
      provider: input.provider,
      display_name: input.displayName,
      mode: input.mode,
      publishable_key: input.publishableKey,
      instructions: input.instructions,
      adapter_config: adapterConfig,
      supports_payouts: definition.supportsPayouts,
      supports_refunds: definition.supportsRefunds,
      fee_percentage: input.feePercentage,
      fee_fixed_amount: input.feeFixedAmount,
      fee_currency: company.baseCurrency,
      updated_by: user.id,
    };

    if (provided.length > 0) {
      const bundle = Object.fromEntries(provided.map(([key, value]) => [key, value.trim()]));

      changes['credentials_encrypted'] = encryptCredentialBundle(bundle);
      changes['credentials_fingerprint'] = sha256Hex(JSON.stringify(bundle));
    }

    if (input.gatewayId) {
      const { data: existing, error: lookupError } = await supabase
        .from('payment_gateways')
        .select('id, credentials_encrypted')
        .eq('id', input.gatewayId)
        .eq('company_id', company.id)
        .is('deleted_at', null)
        .maybeSingle();

      const row = asRow(existing);

      if (lookupError || row === null) {
        throw new AppError('not_found', 'That connection could not be found.');
      }

      const previous = readString(row, 'credentials_encrypted');

      if (provided.length > 0 && previous) {
        changes['previous_credentials_encrypted'] = previous;
        changes['previous_credentials_valid_until'] = new Date(
          Date.now() + GRACE_MINUTES * 60 * 1000
        ).toISOString();
      }

      const { error } = await supabase
        .from('payment_gateways')
        .update(changes)
        .eq('id', input.gatewayId)
        .eq('company_id', company.id);

      if (error) {
        logger.error('Could not save the payment connection', error, { companyId: company.id });

        throw new AppError('database_failure', 'The connection could not be saved.');
      }

      await recordAuditEntry({
        action: 'secret_change',
        entityType: 'payment_gateway',
        entityId: input.gatewayId,
        companyId: company.id,
        description: `The ${definition.label} connection was updated.`,
      });

      revalidatePath('/dashboard/settings/payments');

      return { gatewayId: input.gatewayId };
    }

    changes['created_by'] = user.id;

    const { data, error } = await supabase
      .from('payment_gateways')
      .insert(changes)
      .select('id')
      .single();

    const inserted = asRow(data);

    if (error || inserted === null) {
      logger.error('Could not create the payment connection', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The connection could not be created. You may already have one for this provider and mode.'
      );
    }

    const gatewayId = readString(inserted, 'id') ?? '';

    await recordAuditEntry({
      action: 'secret_change',
      entityType: 'payment_gateway',
      entityId: gatewayId,
      companyId: company.id,
      description: `A ${definition.label} connection was added in ${input.mode} mode.`,
    });

    revalidatePath('/dashboard/settings/payments');

    return { gatewayId };
  },
  { name: 'saveGateway' }
);
