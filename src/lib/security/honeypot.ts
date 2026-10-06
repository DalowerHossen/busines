import type { HoneypotAssessment, HoneypotPayload } from './types';

export const HONEYPOT_FIELD_NAMES = Object.freeze({
  website: 'website',
  formStartedAt: 'form_started_at',
});

export function assessHoneypot(
  payload: HoneypotPayload,
  options: {
    readonly nowMs?: number;
    readonly minimumFillTimeMs?: number;
  } = {}
): HoneypotAssessment {
  const honeypotValue = payload[HONEYPOT_FIELD_NAMES.website];
  if (typeof honeypotValue === 'string' && honeypotValue.trim().length > 0) {
    return { tripped: true, reason: 'filled' };
  }
  if (honeypotValue !== undefined && honeypotValue !== null && typeof honeypotValue !== 'string') {
    return { tripped: true, reason: 'filled' };
  }

  const startedAt = payload[HONEYPOT_FIELD_NAMES.formStartedAt];
  if (startedAt === undefined || startedAt === null || startedAt === '') {
    return { tripped: false, reason: null };
  }
  const startedAtMs = typeof startedAt === 'number' ? startedAt : Number(startedAt);
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
    return { tripped: true, reason: 'invalid-timestamp' };
  }
  const nowMs = options.nowMs ?? Date.now();
  const minimumFillTimeMs = options.minimumFillTimeMs ?? 800;
  if (nowMs - startedAtMs < minimumFillTimeMs) {
    return { tripped: true, reason: 'too-fast' };
  }
  return { tripped: false, reason: null };
}

export function stripHoneypotFields(payload: HoneypotPayload): Readonly<Record<string, unknown>> {
  const safePayload = { ...payload };
  delete safePayload[HONEYPOT_FIELD_NAMES.website];
  delete safePayload[HONEYPOT_FIELD_NAMES.formStartedAt];
  return safePayload;
}
