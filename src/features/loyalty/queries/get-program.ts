// src/features/loyalty/queries/get-program.ts
// Reading the loyalty scheme of one business, what it offers, and what it
// owes its members.

import type { LoyaltyOverview, LoyaltyProgram, LoyaltyReward } from '@/features/loyalty/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type JsonObject } from '@/types/json';

export interface LoyaltyProgramResult {
  program: LoyaltyProgram | null;
  rewards: readonly LoyaltyReward[];
  overview: LoyaltyOverview;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_OVERVIEW: LoyaltyOverview = {
  memberCount: 0,
  pointsOutstanding: 0,
  liabilityAmount: '0',
  rewardsClaimed: 0,
  rewardsWaiting: 0,
  topTierMembers: 0,
};

/**
 * Reads one text value out of an answer.
 *
 * @param source The answer as the database returned it.
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
 * Reads a whole number out of an answer.
 *
 * @param source The answer as the database returned it.
 * @param key Field being read.
 * @returns The number, or nothing.
 */
function whole(source: JsonObject, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Reads a whole number that may be absent.
 *
 * @param source The answer as the database returned it.
 * @param key Field being read.
 * @returns The number, or null.
 */
function optionalWhole(source: JsonObject, key: string): number | null {
  const value = source[key];

  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value) || null;
}

/**
 * Reads the scheme, the rewards and the counts in one pass.
 *
 * @param companyId Business whose scheme is being read.
 * @returns The scheme, the rewards, the counts and whether the read failed.
 */
export async function loadLoyaltyProgram(companyId: string): Promise<LoyaltyProgramResult> {
  const supabase = createServerSupabaseClient();

  const [program, rewards, overview] = await Promise.all([
    supabase.rpc('company_loyalty_program', { p_company_id: companyId }),
    supabase.rpc('company_loyalty_rewards', { p_company_id: companyId }),
    supabase.rpc('loyalty_overview', { p_company_id: companyId }),
  ]);

  if (program.error || rewards.error || overview.error) {
    logger.error(
      'The loyalty scheme could not be read',
      program.error ?? rewards.error ?? overview.error,
      { companyId }
    );

    return { program: null, rewards: [], overview: EMPTY_OVERVIEW, isDegraded: true };
  }

  const source = isJsonObject(program.data) ? program.data : null;
  const counts = isJsonObject(overview.data) ? overview.data : {};

  return {
    program:
      source === null
        ? null
        : {
            programId: text(source, 'program_id') ?? '',
            name: text(source, 'name') ?? '',
            description: text(source, 'description'),
            isActive: source.is_active === true,
            pointsPerCurrencyUnit: text(source, 'points_per_currency_unit') ?? '1',
            earnOn: text(source, 'earn_on') ?? 'payment',
            minimumSpend: text(source, 'minimum_spend') ?? '0',
            pointValue: text(source, 'point_value') ?? '0.01',
            minimumRedemptionPoints: whole(source, 'minimum_redemption_points'),
            redemptionMultiple: whole(source, 'redemption_multiple'),
            pointsExpireAfterMonths: optionalWhole(source, 'points_expire_after_months'),
            silverThreshold: optionalWhole(source, 'silver_threshold'),
            goldThreshold: optionalWhole(source, 'gold_threshold'),
            platinumThreshold: optionalWhole(source, 'platinum_threshold'),
            termsUrl: text(source, 'terms_url'),
            currency: text(source, 'currency') ?? 'USD',
            memberCount: whole(source, 'member_count'),
            pointsIssued: whole(source, 'points_issued'),
            pointsRedeemed: whole(source, 'points_redeemed'),
          },
    rewards: asRows(rewards.data).map((row) => ({
      rewardId: readString(row, 'reward_id') ?? '',
      name: readString(row, 'name') ?? '',
      description: readString(row, 'description'),
      rewardType: readString(row, 'reward_type') ?? 'invoice_credit',
      pointsCost: readNumber(row, 'points_cost') ?? 0,
      creditAmount: readString(row, 'credit_amount'),
      discountPercentage: readString(row, 'discount_percentage'),
      minimumTier: readString(row, 'minimum_tier') ?? 'standard',
      stockQuantity: readNumber(row, 'stock_quantity'),
      redeemedCount: readNumber(row, 'redeemed_count') ?? 0,
      perMemberLimit: readNumber(row, 'per_member_limit'),
      isActive: readBoolean(row, 'is_active'),
      availableFrom: readString(row, 'available_from'),
      availableUntil: readString(row, 'available_until'),
      displayOrder: readNumber(row, 'display_order') ?? 0,
    })),
    overview: {
      memberCount: whole(counts, 'member_count'),
      pointsOutstanding: whole(counts, 'points_outstanding'),
      liabilityAmount: text(counts, 'liability_amount') ?? '0',
      rewardsClaimed: whole(counts, 'rewards_claimed'),
      rewardsWaiting: whole(counts, 'rewards_waiting'),
      topTierMembers: whole(counts, 'top_tier_members'),
    },
    isDegraded: false,
  };
}
