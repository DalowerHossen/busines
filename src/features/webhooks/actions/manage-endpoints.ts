// src/features/webhooks/actions/manage-endpoints.ts
// Pointing a business at its own software, and keeping the signing secret
// where only the receiver and this server can see it.

'use server';

import { revalidatePath } from 'next/cache';

import {
  deliveryIdSchema,
  endpointIdSchema,
  endpointStateSchema,
  saveEndpointSchema,
} from '@/features/webhooks/validation/webhook';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { encryptSecret } from '@/lib/crypto/encryption';
import { randomSecret, sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the webhook screen lives, for cache invalidation. */
const WEBHOOK_PATH = '/dashboard/settings/webhooks';

export interface SaveEndpointResult {
  /** Identifier of the endpoint. */
  endpointId: string;
  /**
   * The signing secret, returned once and never again. The receiving
   * software needs it to verify that an event really came from us.
   */
  signingSecret: string | null;
}

export const saveWebhookEndpoint = createAction(
  saveEndpointSchema,
  async (input): Promise<SaveEndpointResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const isNew = input.endpointId === undefined;
    const secret = isNew ? `whsec_${randomSecret(32)}` : null;

    const { data, error } = await supabase.rpc('save_webhook_endpoint', {
      p_company_id: company.id,
      p_name: input.name,
      p_target_url: input.targetUrl,
      p_subscribed_events: [...input.subscribedEvents],
      p_signing_secret_encrypted: secret === null ? null : encryptSecret(secret),
      p_signing_secret_fingerprint: secret === null ? null : sha256Hex(secret),
      p_description: input.description ?? null,
      p_endpoint_id: input.endpointId ?? null,
    });

    if (error) {
      logger.error('A webhook endpoint could not be saved', error, { companyId: company.id });

      throw new AppError(
        'validation_failed',
        error.message.includes('private network')
          ? 'That address is inside a private network and cannot receive events.'
          : 'That endpoint could not be saved. The address has to be a secure public one.'
      );
    }

    const endpointId = typeof data === 'string' ? data : null;

    if (endpointId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: isNew ? 'insert' : 'update',
      entityType: 'webhook_endpoint',
      entityId: endpointId,
      companyId: company.id,
      description: `Events are sent to ${input.targetUrl}.`,
      metadata: { events: [...input.subscribedEvents] },
    });

    revalidatePath(WEBHOOK_PATH);

    return { endpointId, signingSecret: secret };
  },
  { name: 'saveWebhookEndpoint' }
);

export const setWebhookEndpointState = createAction(
  endpointStateSchema,
  async (input): Promise<{ isActive: boolean }> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('set_webhook_endpoint_state', {
      p_endpoint_id: input.endpointId,
      p_is_active: input.isActive,
      p_reason: input.isActive ? null : 'Switched off by the account owner.',
    });

    if (error) {
      logger.error('A webhook endpoint could not be switched', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'That endpoint could not be changed.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'webhook_endpoint',
      entityId: input.endpointId,
      companyId: company.id,
      description: input.isActive ? 'Endpoint switched on.' : 'Endpoint switched off.',
    });

    revalidatePath(WEBHOOK_PATH);

    return { isActive: input.isActive };
  },
  { name: 'setWebhookEndpointState' }
);

export const removeWebhookEndpoint = createAction(
  endpointIdSchema,
  async (input): Promise<{ isRemoved: boolean }> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('delete_webhook_endpoint', {
      p_endpoint_id: input.endpointId,
    });

    if (error) {
      logger.error('A webhook endpoint could not be removed', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'That endpoint could not be removed.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'webhook_endpoint',
      entityId: input.endpointId,
      companyId: company.id,
      description: 'Endpoint removed; its delivery history is kept.',
    });

    revalidatePath(WEBHOOK_PATH);

    return { isRemoved: data === true };
  },
  { name: 'removeWebhookEndpoint' }
);

export const replayWebhookDelivery = createAction(
  deliveryIdSchema,
  async (input): Promise<{ isQueued: boolean }> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('replay_webhook_delivery', {
      p_delivery_id: input.deliveryId,
    });

    if (error) {
      logger.error('A webhook delivery could not be replayed', error, {
        companyId: company.id,
      });

      throw new AppError(
        'database_failure',
        'That delivery could not be sent again. The endpoint may have been removed.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'webhook_delivery',
      entityId: input.deliveryId,
      companyId: company.id,
      description: 'Delivery queued to be sent again.',
    });

    revalidatePath(WEBHOOK_PATH);

    return { isQueued: typeof data === 'string' };
  },
  { name: 'replayWebhookDelivery' }
);
