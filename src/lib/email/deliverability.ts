import { createHmac } from 'node:crypto';

import type { EmailDeliveryEventStatus, VerifiedEmailWebhookEvent } from './webhooks';

export type EmailSuppressionReason = 'hard_bounce' | 'complaint' | 'provider_suppressed';

export interface EmailSuppressionStore {
  isSuppressed(addressHash: string): Promise<boolean>;
  suppress(input: {
    readonly addressHash: string;
    readonly reason: EmailSuppressionReason;
    readonly providerEventId: string;
  }): Promise<void>;
}

export function normalizeEmailAddress(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(normalized)) {
    throw new Error('Email address must use a valid mailbox format.');
  }
  return normalized;
}

export function hashEmailAddress(value: string, hashingSecret: string): string {
  return createHmac('sha256', hashingSecret)
    .update(normalizeEmailAddress(value), 'utf8')
    .digest('hex');
}

export async function filterSuppressedRecipients(input: {
  readonly recipients: readonly string[];
  readonly hashingSecret: string;
  readonly suppressionStore: EmailSuppressionStore;
}): Promise<readonly string[]> {
  const allowed: string[] = [];
  for (const recipient of input.recipients) {
    const normalized = normalizeEmailAddress(recipient);
    const suppressed = await input.suppressionStore.isSuppressed(
      hashEmailAddress(normalized, input.hashingSecret)
    );
    if (!suppressed) allowed.push(recipient);
  }
  return allowed;
}

function reasonForStatus(status: EmailDeliveryEventStatus): EmailSuppressionReason | null {
  switch (status) {
    case 'bounced':
      return 'hard_bounce';
    case 'complained':
      return 'complaint';
    case 'suppressed':
      return 'provider_suppressed';
    default:
      return null;
  }
}

export async function recordSuppressionFromResendEvent(input: {
  readonly event: VerifiedEmailWebhookEvent;
  readonly hashingSecret: string;
  readonly suppressionStore: EmailSuppressionStore;
}): Promise<void> {
  const reason = reasonForStatus(input.event.status);
  if (!reason) return;
  for (const recipient of input.event.recipients) {
    await input.suppressionStore.suppress({
      addressHash: hashEmailAddress(recipient, input.hashingSecret),
      reason,
      providerEventId: input.event.providerEventId,
    });
  }
}
