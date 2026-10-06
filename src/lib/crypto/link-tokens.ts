// src/lib/crypto/link-tokens.ts
// Signed tokens for the links sent to clients and e-signature signers. A
// client never holds an account, so the token itself carries the permission.

import 'server-only';

import { serverEnv } from '@/lib/env/env.server';
import { hmacBase64Url, signaturesMatch } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';

export const LINK_TOKEN_PURPOSES = [
  'invoice_view',
  'estimate_view',
  'statement_view',
  'payment_page',
  'contract_sign',
  'receipt_view',
  'unsubscribe',
] as const;

export type LinkTokenPurpose = (typeof LINK_TOKEN_PURPOSES)[number];

export interface LinkTokenPayload {
  purpose: LinkTokenPurpose;
  documentId: string;
  companyId: string;
  recipientId: string | null;
  expiresAt: number;
}

/**
 * Encodes a payload as compact base64url JSON.
 *
 * @param payload Payload to encode.
 * @returns The encoded body of the token.
 */
function encodePayload(payload: LinkTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decodes the body of a token back into a payload.
 *
 * @param body Encoded body.
 * @returns The payload, or null when it cannot be read.
 */
function decodePayload(body: string): LinkTokenPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<LinkTokenPayload>;

    if (
      typeof candidate.purpose !== 'string' ||
      !LINK_TOKEN_PURPOSES.includes(candidate.purpose as LinkTokenPurpose) ||
      typeof candidate.documentId !== 'string' ||
      typeof candidate.companyId !== 'string' ||
      typeof candidate.expiresAt !== 'number'
    ) {
      return null;
    }

    return {
      purpose: candidate.purpose as LinkTokenPurpose,
      documentId: candidate.documentId,
      companyId: candidate.companyId,
      recipientId: typeof candidate.recipientId === 'string' ? candidate.recipientId : null,
      expiresAt: candidate.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a signed token for a client facing link.
 *
 * @param payload What the link grants access to.
 * @returns The token to put in the URL.
 */
export function createLinkToken(payload: LinkTokenPayload): string {
  const body = encodePayload(payload);
  const signature = hmacBase64Url(body, serverEnv.LINK_SIGNING_SECRET);
  return `${body}.${signature}`;
}

/**
 * Creates a signed token that expires after a number of days.
 *
 * @param payload Everything except the expiry.
 * @param validForDays How long the link should work.
 * @returns The token to put in the URL.
 */
export function createLinkTokenValidForDays(
  payload: Omit<LinkTokenPayload, 'expiresAt'>,
  validForDays: number
): string {
  const expiresAt = Date.now() + validForDays * 24 * 60 * 60 * 1000;
  return createLinkToken({ ...payload, expiresAt });
}

/**
 * Verifies a token and returns what it grants access to.
 *
 * @param token Token taken from the URL.
 * @returns The payload the token carries.
 */
export function verifyLinkToken(token: string): LinkTokenPayload {
  const separator = token.lastIndexOf('.');

  if (separator <= 0) {
    throw new AppError('forbidden', 'This link is not valid.');
  }

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = hmacBase64Url(body, serverEnv.LINK_SIGNING_SECRET);

  if (!signaturesMatch(signature, expected)) {
    throw new AppError('forbidden', 'This link is not valid.');
  }

  const payload = decodePayload(body);

  if (!payload) {
    throw new AppError('forbidden', 'This link is not valid.');
  }

  if (payload.expiresAt < Date.now()) {
    throw new AppError('forbidden', 'This link has expired. Please ask for a new one.');
  }

  return payload;
}

/**
 * Verifies a token and checks that it was issued for the expected purpose.
 *
 * @param token Token taken from the URL.
 * @param purpose Purpose the page requires.
 * @returns The payload the token carries.
 */
export function verifyLinkTokenForPurpose(
  token: string,
  purpose: LinkTokenPurpose
): LinkTokenPayload {
  const payload = verifyLinkToken(token);

  if (payload.purpose !== purpose) {
    throw new AppError('forbidden', 'This link is not valid.');
  }

  return payload;
}
