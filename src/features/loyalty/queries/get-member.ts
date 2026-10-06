// src/features/loyalty/queries/get-member.ts
// Reading one membership with every movement and every reward claimed.

import type {
  LoyaltyMemberDetail,
  LoyaltyMovement,
  LoyaltyRedemption,
} from '@/features/loyalty/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type Json, type JsonObject } from '@/types/json';

/**
 * Reads one text value out of the answer.
 *
 * @param source The membership as the database returned it.
 * @param key Field being read.
 * @returns The value, or null.
 */
function text(source: JsonObject, key: string): string | null {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : null;
}

/**
 * Reads a whole number out of the answer.
 *
 * @param source The membership as the database returned it.
 * @param key Field being read.
 * @returns The number, or nothing.
 */
function whole(source: JsonObject, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Maps the movements of one membership.
 *
 * @param value The movements as the database returned them.
 * @returns The movements, newest first.
 */
function toMovements(value: Json | undefined): readonly LoyaltyMovement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonObject).map((entry) => ({
    movementId: text(entry, 'movement_id') ?? '',
    entryType: text(entry, 'entry_type') ?? 'earned',
    points: whole(entry, 'points'),
    balanceAfter: whole(entry, 'balance_after'),
    reason: text(entry, 'reason') ?? '',
    expiresOn: text(entry, 'expires_on'),
    createdAt: text(entry, 'created_at') ?? '',
  }));
}

/**
 * Maps the rewards one membership has claimed.
 *
 * @param value The claims as the database returned them.
 * @returns The claims, newest first.
 */
function toRedemptions(value: Json | undefined): readonly LoyaltyRedemption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonObject).map((entry) => ({
    redemptionId: text(entry, 'redemption_id') ?? '',
    redemptionCode: text(entry, 'redemption_code') ?? '',
    rewardName: text(entry, 'reward_name'),
    pointsSpent: whole(entry, 'points_spent'),
    rewardValue: text(entry, 'reward_value'),
    currency: text(entry, 'currency') ?? 'USD',
    status: text(entry, 'status') ?? 'issued',
    issuedAt: text(entry, 'issued_at') ?? '',
    expiresOn: text(entry, 'expires_on'),
    appliedAt: text(entry, 'applied_at'),
  }));
}

/**
 * Reads one membership.
 *
 * @param accountId Membership being read.
 * @returns The membership, or null when it is gone or belongs elsewhere.
 */
export async function loadLoyaltyMember(accountId: string): Promise<LoyaltyMemberDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('loyalty_member_detail', {
    p_account_id: accountId,
  });

  if (error || !isJsonObject(data)) {
    if (error) {
      logger.error('One loyalty membership could not be read', error, { accountId });
    }

    return null;
  }

  return {
    accountId: text(data, 'account_id') ?? accountId,
    membershipNumber: text(data, 'membership_number') ?? '',
    clientId: text(data, 'client_id'),
    clientName: text(data, 'client_name'),
    tier: text(data, 'tier') ?? 'standard',
    tierAchievedAt: text(data, 'tier_achieved_at'),
    pointsBalance: whole(data, 'points_balance'),
    pointsValue: text(data, 'points_value') ?? '0',
    currency: text(data, 'currency') ?? 'USD',
    pointsEarnedLifetime: whole(data, 'points_earned_lifetime'),
    pointsRedeemedLifetime: whole(data, 'points_redeemed_lifetime'),
    pointsExpiredLifetime: whole(data, 'points_expired_lifetime'),
    joinedAt: text(data, 'joined_at') ?? '',
    nextExpiryDate: text(data, 'next_expiry_date'),
    isSuspended: data.is_suspended === true,
    suspensionReason: text(data, 'suspension_reason'),
    movements: toMovements(data.movements),
    redemptions: toRedemptions(data.redemptions),
  };
}
