// src/features/analytics/actions/save-destination.ts
// Adding or editing a measurement destination from the console.

'use server';

import { revalidatePath } from 'next/cache';

import {
  destinationIdSchema,
  saveDestinationSchema,
} from '@/features/analytics/validation/analytics';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { encryptSecret } from '@/lib/crypto/encryption';
import { secretHint } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveDestinationResult {
  /** Identifier of the destination that was saved. */
  destinationId: string;
}

export const saveMeasurementDestination = createAction(
  saveDestinationSchema,
  async (input): Promise<SaveDestinationResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();
    const hasToken = input.accessToken !== undefined && input.accessToken !== '';

    const { data, error } = await supabase.rpc('save_analytics_destination', {
      p_provider_key: input.providerKey,
      p_label: input.label,
      p_public_identifier: input.publicIdentifier,
      p_consent_category: input.consentCategory,
      p_is_enabled: input.isEnabled,
      p_loads_on_marketing_pages: input.loadsOnMarketingPages,
      p_loads_on_application_pages: input.loadsOnApplicationPages,
      p_access_token_encrypted: hasToken ? encryptSecret(input.accessToken ?? '') : null,
      p_token_hint: hasToken ? secretHint(input.accessToken ?? '') : null,
      p_notes: input.notes ?? null,
    });

    if (error) {
      logger.error('A measurement destination could not be saved', error, {
        provider: input.providerKey,
      });

      throw new AppError(
        'database_failure',
        'That destination could not be saved. Check the identifier and try again.'
      );
    }

    const destinationId = typeof data === 'string' ? data : null;

    if (destinationId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'analytics_destination',
      entityId: destinationId,
      description: `Measurement destination ${input.providerKey} saved.`,
      metadata: { provider: input.providerKey, is_enabled: input.isEnabled },
    });

    revalidatePath('/admin/measurement');

    return { destinationId };
  },
  { name: 'saveMeasurementDestination' }
);

export interface RemoveDestinationResult {
  /** True when it is no longer loaded anywhere. */
  isRemoved: boolean;
}

export const removeMeasurementDestination = createAction(
  destinationIdSchema,
  async (input): Promise<RemoveDestinationResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('remove_analytics_destination', {
      p_destination_id: input.destinationId,
    });

    if (error) {
      logger.error('A measurement destination could not be removed', error);

      throw new AppError('database_failure', 'That destination could not be removed.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'analytics_destination',
      entityId: input.destinationId,
      description: 'Measurement destination removed.',
    });

    revalidatePath('/admin/measurement');

    return { isRemoved: data === true };
  },
  { name: 'removeMeasurementDestination' }
);
