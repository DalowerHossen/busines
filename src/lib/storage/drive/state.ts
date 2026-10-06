// src/lib/storage/drive/state.ts
// Carrying who asked for a drive connection through the consent screen.
//
// The value travels through a service we do not control, so it is signed and
// it expires. An answer that comes back for a business other than the one
// that started the request is simply not accepted.

import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { serverEnv } from '@/env/server';

/** How long a consent may take before the answer stops being accepted. */
const WINDOW_SECONDS = 900;

export interface DriveState {
  companyId: string;
  userId: string;
}

/**
 * Signs the state carried through the consent screen.
 *
 * @param companyId Business asking for the connection.
 * @param userId Person who asked.
 * @returns The signed state.
 */
export function signDriveState(companyId: string, userId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${companyId}.${userId}.${String(issuedAt)}`;
  const signature = createHmac('sha256', serverEnv.LINK_SIGNING_SECRET)
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}

/**
 * Reads the state the consent screen sent back.
 *
 * @param state Value returned by the drive.
 * @returns Who started the request, or null when it cannot be trusted.
 */
export function readDriveState(state: string | null): DriveState | null {
  if (state === null) {
    return null;
  }

  const parts = state.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const [companyId, userId, issuedAt, signature] = parts;

  if (
    companyId === undefined ||
    userId === undefined ||
    issuedAt === undefined ||
    signature === undefined
  ) {
    return null;
  }

  const issued = Number.parseInt(issuedAt, 10);

  if (!Number.isFinite(issued) || Date.now() / 1000 - issued > WINDOW_SECONDS) {
    return null;
  }

  const expected = Buffer.from(
    createHmac('sha256', serverEnv.LINK_SIGNING_SECRET)
      .update(`${companyId}.${userId}.${issuedAt}`)
      .digest('hex'),
    'utf8'
  );
  const received = Buffer.from(signature, 'utf8');

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  return { companyId, userId };
}
