// src/features/webhooks/queries/list-endpoints.ts
// Reading where a business sends its events, and how it is going.

import type { WebhookDeliveryRow, WebhookEndpointRow } from '@/features/webhooks/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString, readStringArray } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface WebhookBoard {
  endpoints: readonly WebhookEndpointRow[];
  deliveries: readonly WebhookDeliveryRow[];
  /** True when something could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the endpoints and recent deliveries of one business.
 *
 * @param companyId Business being read.
 * @returns Where events go and what happened to them.
 */
export async function loadWebhookBoard(companyId: string): Promise<WebhookBoard> {
  const supabase = createServerSupabaseClient();

  const [endpoints, deliveries] = await Promise.all([
    supabase.rpc('webhook_endpoint_list', { p_company_id: companyId }),
    supabase.rpc('webhook_delivery_history', { p_company_id: companyId, p_limit: 50 }),
  ]);

  if (endpoints.error) {
    logger.error('The webhook endpoints could not be read', endpoints.error, { companyId });

    return { endpoints: [], deliveries: [], isDegraded: true };
  }

  return {
    endpoints: asRows(endpoints.data).map((row) => ({
      endpointId: readString(row, 'endpoint_id') ?? '',
      name: readString(row, 'name') ?? '',
      targetUrl: readString(row, 'target_url') ?? '',
      description: readString(row, 'description'),
      subscribedEvents: readStringArray(row, 'subscribed_events'),
      isActive: readBoolean(row, 'is_active'),
      secretFingerprint: readString(row, 'secret_fingerprint') ?? '',
      secretKeyVersion: readNumber(row, 'secret_key_version') ?? 1,
      consecutiveFailures: readNumber(row, 'consecutive_failures') ?? 0,
      disabledReason: readString(row, 'disabled_reason'),
      lastSuccessAt: readString(row, 'last_success_at'),
      lastFailureAt: readString(row, 'last_failure_at'),
      lastStatusCode: readNumber(row, 'last_status_code'),
      pendingCount: readNumber(row, 'pending_count') ?? 0,
      deadLetterCount: readNumber(row, 'dead_letter_count') ?? 0,
    })),
    deliveries: asRows(deliveries.data).map((row) => ({
      deliveryId: readString(row, 'delivery_id') ?? '',
      endpointName: readString(row, 'endpoint_name') ?? '',
      eventType: readString(row, 'event_type'),
      status: readString(row, 'status') ?? 'pending',
      attemptCount: readNumber(row, 'attempt_count') ?? 0,
      lastStatusCode: readNumber(row, 'last_status_code'),
      lastError: readString(row, 'last_error'),
      nextAttemptAt: readString(row, 'next_attempt_at'),
      deliveredAt: readString(row, 'delivered_at'),
      deadLetteredAt: readString(row, 'dead_lettered_at'),
      createdAt: readString(row, 'created_at') ?? '',
    })),
    isDegraded: false,
  };
}
