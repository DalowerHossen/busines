// src/lib/payments/webhooks.ts
// Provider adapters verify authenticity; this layer defines the atomic
// persistence contract that prevents replayed webhook events from being
// applied twice and rejects out-of-order state changes.
import type { GatewayId } from '@/types/payment';
import type { VerifiedWebhookEvent } from './types';

export interface WebhookEventClaimStore {
  /**
   * Atomically inserts a provider event id. Returns false when the unique
   * gateway/event key already exists.
   */
  claim(gateway: GatewayId, providerEventId: string, event: VerifiedWebhookEvent): Promise<boolean>;
  /** Returns the last event timestamp applied to a provider transaction. */
  latestOccurredAt(gateway: GatewayId, providerTransactionId: string): Promise<string | null>;
}

export interface WebhookApplicationDecision {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly stale: boolean;
}

export async function claimWebhookEvent(
  store: WebhookEventClaimStore,
  gateway: GatewayId,
  event: VerifiedWebhookEvent,
  providerTransactionId: string
): Promise<WebhookApplicationDecision> {
  const claimed = await store.claim(gateway, event.providerEventId, event);
  if (!claimed) return { accepted: false, duplicate: true, stale: false };

  const latestOccurredAt = await store.latestOccurredAt(gateway, providerTransactionId);
  const incomingTime = event.occurredAt ? Date.parse(event.occurredAt) : Number.NaN;
  const latestTime = latestOccurredAt ? Date.parse(latestOccurredAt) : Number.NaN;
  const stale =
    Number.isFinite(incomingTime) && Number.isFinite(latestTime) && incomingTime < latestTime;
  return { accepted: !stale, duplicate: false, stale };
}

export function webhookDedupeKey(gateway: GatewayId, providerEventId: string): string {
  return `${gateway}:${providerEventId}`;
}
