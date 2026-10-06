import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { SecurityProviderError, securityInvalidRequest } from './errors';

const TOKEN_TTL_SECONDS = 3_600;

export function createCsrfToken(input: {
  readonly secret: string;
  readonly sessionId: string;
  readonly issuedAtSeconds?: number;
}): string {
  if (!input.secret || !input.sessionId) throw securityInvalidRequest();
  const issuedAt = input.issuedAtSeconds ?? Math.floor(Date.now() / 1_000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 1) throw securityInvalidRequest();
  const payload = `${input.sessionId}.${issuedAt}`;
  const signature = createHmac('sha256', input.secret).update(payload, 'utf8').digest('base64url');
  return `${issuedAt}.${signature}`;
}

export function verifyCsrfToken(input: {
  readonly token: string;
  readonly secret: string;
  readonly sessionId: string;
  readonly nowSeconds?: number;
  readonly maxAgeSeconds?: number;
}): boolean {
  if (!input.token || !input.secret || !input.sessionId) return false;
  const [issuedAtValue, signature] = input.token.split('.', 2);
  const issuedAt = Number(issuedAtValue);
  if (
    !signature ||
    !Number.isSafeInteger(issuedAt) ||
    issuedAt < 1 ||
    issuedAt > (input.nowSeconds ?? Math.floor(Date.now() / 1_000))
  ) {
    return false;
  }
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  const maxAgeSeconds = input.maxAgeSeconds ?? TOKEN_TTL_SECONDS;
  if (nowSeconds - issuedAt > maxAgeSeconds) return false;
  const payload = `${input.sessionId}.${issuedAt}`;
  const expected = createHmac('sha256', input.secret).update(payload, 'utf8').digest('base64url');
  return constantTimeEqual(expected, signature);
}

export function assertSameOrigin(origin: string | undefined, applicationOrigin: string): void {
  if (!origin || !applicationOrigin) throw securityInvalidRequest();
  try {
    if (new URL(origin).origin !== new URL(applicationOrigin).origin) {
      throw securityInvalidRequest();
    }
  } catch (error) {
    if (error instanceof SecurityProviderError) throw error;
    throw securityInvalidRequest();
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
