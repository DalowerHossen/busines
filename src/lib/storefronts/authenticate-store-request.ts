// src/lib/storefronts/authenticate-store-request.ts
// Turning the key a shop sent into the connection behind it.
//
// Shops hold a key rather than a user session, so every call from a shop
// starts here. The key is hashed before it is looked up, the lookup is rate
// limited by key, and a shop that has not been taken live is refused even
// when its key is perfectly good.

import 'server-only';

import type { NextRequest } from 'next/server';

import { sha256Hex } from '@/lib/crypto/hashing';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readString } from '@/lib/records';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface StorefrontCaller {
  connectionId: string;
  companyId: string;
  platform: string;
  defaultCurrency: string;
  autoIssueInvoice: boolean;
}

export type StorefrontAuthResult =
  | { kind: 'granted'; caller: StorefrontCaller }
  | { kind: 'refused'; message: string }
  | { kind: 'not_live'; message: string }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

/** Header a shop sends its key in. */
const KEY_HEADER = 'x-store-key';

/**
 * Reads the key from a request.
 *
 * @param request Incoming request.
 * @returns The key, or null when none was sent.
 */
function readStoreKey(request: NextRequest): string | null {
  const header = request.headers.get(KEY_HEADER);

  if (header !== null && header.trim() !== '') {
    return header.trim();
  }

  const authorisation = request.headers.get('authorization');

  if (authorisation !== null && authorisation.toLowerCase().startsWith('bearer ')) {
    const token = authorisation.slice(7).trim();

    return token === '' ? null : token;
  }

  return null;
}

/**
 * Authenticates one call made by a shop.
 *
 * @param request Incoming request.
 * @returns The connection behind the key, or why the call is refused.
 */
export async function authenticateStoreRequest(
  request: NextRequest
): Promise<StorefrontAuthResult> {
  const key = readStoreKey(request);

  if (key === null) {
    return { kind: 'refused', message: 'Send your shop key in the X-Store-Key header.' };
  }

  const keyHash = sha256Hex(key);

  const decision = await consumeRateLimit({
    kind: 'storefront_api',
    key: keyHash,
    limit: 120,
    windowSeconds: 60,
  });

  if (!decision.isAllowed) {
    return { kind: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds };
  }

  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('authenticate_storefront_key', {
    p_key_hash: keyHash,
  });

  if (error) {
    logger.error('A shop key could not be checked', error);

    return { kind: 'refused', message: 'That key could not be checked. Try again shortly.' };
  }

  const row = asRows(data)[0];

  if (row === undefined) {
    return { kind: 'refused', message: 'That shop key is not valid.' };
  }

  const status = readString(row, 'status') ?? 'pending_verification';

  if (status !== 'active') {
    return {
      kind: 'not_live',
      message:
        'This shop is not live yet. It can take payment once the business has been verified.',
    };
  }

  return {
    kind: 'granted',
    caller: {
      connectionId: readString(row, 'connection_id') ?? '',
      companyId: readString(row, 'company_id') ?? '',
      platform: readString(row, 'platform') ?? 'custom',
      defaultCurrency: readString(row, 'default_currency') ?? 'USD',
      autoIssueInvoice: readBoolean(row, 'auto_issue_invoice'),
    },
  };
}
