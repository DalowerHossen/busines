// src/features/webhooks/types.ts
// The shapes the outbound webhook screens work with.

export interface WebhookEndpointRow {
  endpointId: string;
  name: string;
  targetUrl: string;
  description: string | null;
  subscribedEvents: readonly string[];
  isActive: boolean;
  secretFingerprint: string;
  secretKeyVersion: number;
  consecutiveFailures: number;
  disabledReason: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastStatusCode: number | null;
  pendingCount: number;
  deadLetterCount: number;
}

export interface WebhookDeliveryRow {
  deliveryId: string;
  endpointName: string;
  eventType: string | null;
  status: string;
  attemptCount: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  deadLetteredAt: string | null;
  createdAt: string;
}
