// src/features/affiliates/services/attribution.ts
// Tying a new business back to the partner that sent it. The browser carries
// a random visitor token and nothing else, so attribution never depends on
// storing an address or profiling the visitor.

import 'server-only';

import { cookies } from 'next/headers';

import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

/** Name of the cookie that carries the visitor token. */
export const VISITOR_COOKIE = 'kd_visitor';

/** How long a visitor token survives, in seconds. */
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * Reads the visitor token from the request, when there is one.
 *
 * @returns The token, or null when this visitor arrived directly.
 */
export function readVisitorToken(): string | null {
  const value = cookies().get(VISITOR_COOKIE)?.value ?? null;

  if (value === null || value.length < 8 || value.length > 120) {
    return null;
  }

  return value;
}

/**
 * Credits a brand new business to the partner whose link brought it here.
 *
 * @param companyId Business that was just created.
 * @param ipHash Hashed address of the signup, used only for fraud review.
 * @returns Nothing; failure to attribute never blocks a signup.
 */
export async function attributeSignup(companyId: string, ipHash: string | null): Promise<void> {
  const token = readVisitorToken();

  if (token === null) {
    return;
  }

  const supabase = getServiceSupabaseClient();

  const { error } = await supabase.rpc('attribute_affiliate_signup', {
    p_company_id: companyId,
    p_visitor_token: token,
    p_signup_ip_hash: ipHash,
  });

  if (error) {
    logger.warn('A signup could not be credited to a referral partner', { companyId });
  }
}
