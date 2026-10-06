import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { EmailProvider } from './types';

export type ResendEmailEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.bounced'
  | 'email.complained'
  | 'email.delivery_delayed'
  | 'email.failed'
  | 'email.opened'
  | 'email.clicked'
  | 'email.suppressed';

export type EmailDeliveryEventStatus =
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'delayed'
  | 'failed'
  | 'opened'
  | 'clicked'
  | 'suppressed';

export interface VerifiedEmailWebhookEvent {
  readonly provider: EmailProvider;
  readonly providerEventId: string;
  readonly type: ResendEmailEventType;
  readonly emailId: string | null;
  readonly status: EmailDeliveryEventStatus;
  readonly recipients: readonly string[];
  readonly occurredAt: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function headerValue(
  headers: Readonly<Record<string, string | undefined>>,
  name: string
): string | undefined {
  const wanted = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === wanted)?.[1];
}

function signingSecret(secret: string): Buffer {
  const trimmed = secret.trim();
  if (!trimmed.startsWith('whsec_')) {
    throw new Error('Resend webhook secret has an invalid format.');
  }
  const encoded = trimmed.slice('whsec_'.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('Resend webhook secret has an invalid format.');
  }
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.length === 0) {
    throw new Error('Resend webhook secret has an invalid format.');
  }
  return decoded;
}

export function verifyResendWebhook(input: {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly webhookSecret: string;
  readonly now?: Date;
  readonly toleranceSeconds?: number;
}): boolean {
  const svixId = headerValue(input.headers, 'svix-id');
  const svixTimestamp = headerValue(input.headers, 'svix-timestamp');
  const svixSignature = headerValue(input.headers, 'svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) return false;
  const timestamp = Number(svixTimestamp);
  const tolerance = input.toleranceSeconds ?? 300;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > tolerance)
    return false;

  const expected = createHmac('sha256', signingSecret(input.webhookSecret))
    .update(`${svixId}.${svixTimestamp}.${input.rawBody}`, 'utf8')
    .digest('base64');
  const signatures = svixSignature
    .split(' ')
    .map((value) => value.split(','))
    .filter((value) => value.length === 2 && value[0] === 'v1');
  return signatures.some((value) => constantTimeEqual(value[1] ?? '', expected));
}

function statusFor(type: ResendEmailEventType): EmailDeliveryEventStatus {
  switch (type) {
    case 'email.sent':
      return 'sent';
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    case 'email.delivery_delayed':
      return 'delayed';
    case 'email.failed':
      return 'failed';
    case 'email.opened':
      return 'opened';
    case 'email.clicked':
      return 'clicked';
    case 'email.suppressed':
      return 'suppressed';
  }
}

export function parseVerifiedResendWebhook(input: {
  readonly rawBody: string;
  readonly providerEventId: string;
}): VerifiedEmailWebhookEvent {
  if (input.providerEventId.trim().length === 0) {
    throw new Error('Resend webhook provider event ID is required for deduplication.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    throw new Error('Resend email webhook payload is invalid.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Resend email webhook payload is invalid.');
  }
  const payload = parsed as Record<string, unknown>;
  const type = payload.type;
  if (
    type !== 'email.sent' &&
    type !== 'email.delivered' &&
    type !== 'email.bounced' &&
    type !== 'email.complained' &&
    type !== 'email.delivery_delayed' &&
    type !== 'email.failed' &&
    type !== 'email.opened' &&
    type !== 'email.clicked' &&
    type !== 'email.suppressed'
  ) {
    throw new Error('Unsupported Resend email webhook event.');
  }
  const data =
    typeof payload.data === 'object' && payload.data !== null && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : {};
  const recipients = Array.isArray(data.to)
    ? data.to.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    provider: 'resend_api',
    providerEventId: input.providerEventId,
    type,
    emailId: typeof data.email_id === 'string' ? data.email_id : null,
    status: statusFor(type),
    recipients,
    occurredAt: typeof payload.created_at === 'string' ? payload.created_at : null,
    payload,
  };
}
