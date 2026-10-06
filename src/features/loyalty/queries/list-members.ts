// src/features/loyalty/queries/list-members.ts
// Reading the members of a loyalty scheme, the biggest balances first.

import type { LoyaltyMemberSummary } from '@/features/loyalty/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Reads the members of one scheme.
 *
 * @param companyId Business whose members are being read.
 * @param search Optional membership number or client name to narrow by.
 * @returns The members.
 */
export async function loadLoyaltyMembers(
  companyId: string,
  search: string | null = null
): Promise<readonly LoyaltyMemberSummary[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('company_loyalty_members', {
    p_company_id: companyId,
    p_search: search,
    p_limit: 100,
  });

  if (error) {
    logger.error('The loyalty members could not be read', error, { companyId });

    return [];
  }

  return asRows(data).map((row) => ({
    accountId: readString(row, 'account_id') ?? '',
    membershipNumber: readString(row, 'membership_number') ?? '',
    clientId: readString(row, 'client_id'),
    clientName: readString(row, 'client_name'),
    tier: readString(row, 'tier') ?? 'standard',
    pointsBalance: readNumber(row, 'points_balance') ?? 0,
    pointsValue: readString(row, 'points_value') ?? '0',
    pointsEarnedLifetime: readNumber(row, 'points_earned_lifetime') ?? 0,
    pointsRedeemedLifetime: readNumber(row, 'points_redeemed_lifetime') ?? 0,
    nextExpiryDate: readString(row, 'next_expiry_date'),
    lastEarnedAt: readString(row, 'last_earned_at'),
    isSuspended: readBoolean(row, 'is_suspended'),
  }));
}
