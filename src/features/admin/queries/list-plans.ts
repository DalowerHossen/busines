// src/features/admin/queries/list-plans.ts
// Reading the plan catalogue and the discount codes for the platform
// console, including the plans that are hidden or archived.

import type { PlanOption } from '@/features/billing/types';
import { logger } from '@/lib/logger';
import {
  asRows,
  readAmount,
  readBoolean,
  readEnum,
  readJson,
  readNumber,
  readString,
} from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import type { JsonObject } from '@/types/json';
import { BILLING_INTERVALS, COUPON_TYPES, type CouponType } from '@/types/enums';

export interface AdminPlan extends PlanOption {
  isPublic: boolean;
  isArchived: boolean;
  isDefaultOnSignup: boolean;
  /** How many businesses are on this plan right now. */
  subscriberCount: number;
}

export interface AdminCoupon {
  id: string;
  code: string;
  name: string;
  couponType: CouponType;
  value: string;
  currency: string | null;
  durationMonths: number | null;
  maxRedemptions: number | null;
  maxRedemptionsPerAccount: number;
  redemptionCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  campaignName: string | null;
}

export interface PlanCatalogue {
  plans: readonly AdminPlan[];
  coupons: readonly AdminCoupon[];
  /** True when the catalogue could not be read. */
  isDegraded: boolean;
}

/**
 * Reads a limits document into numbers, keeping unlimited as null.
 *
 * @param document Raw limits document.
 * @returns The limits the console renders.
 */
function toLimits(document: JsonObject): Record<string, number | null> {
  const limits: Record<string, number | null> = {};

  for (const [key, value] of Object.entries(document)) {
    limits[key] = typeof value === 'number' ? value : null;
  }

  return limits;
}

/**
 * Reads a features document into switches.
 *
 * @param document Raw features document.
 * @returns The modules the plan unlocks.
 */
function toFeatures(document: JsonObject): Record<string, boolean> {
  const features: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(document)) {
    features[key] = value === true;
  }

  return features;
}

/**
 * Maps one plan row for the console.
 *
 * @param row Row read from public.subscription_plans.
 * @param priceRows Price rows for every plan.
 * @param counts How many businesses sit on each plan.
 * @returns The plan the console renders.
 */
function toAdminPlan(
  row: DatabaseRow,
  priceRows: readonly DatabaseRow[],
  counts: ReadonlyMap<string, number>
): AdminPlan {
  const id = readString(row, 'id') ?? '';

  return {
    id,
    planKey: readString(row, 'plan_key') ?? '',
    name: readString(row, 'name') ?? '',
    tagline: readString(row, 'tagline'),
    description: readString(row, 'description'),
    isFree: readBoolean(row, 'is_free'),
    trialDays: readNumber(row, 'trial_days') ?? 0,
    badgeLabel: readString(row, 'badge_label'),
    displayOrder: readNumber(row, 'display_order') ?? 0,
    limits: toLimits(readJson(row, 'limits')),
    features: toFeatures(readJson(row, 'features')),
    merchantFeePercentage: readAmount(row, 'merchant_of_record_fee_percentage'),
    merchantFeeFixed: readAmount(row, 'merchant_of_record_fee_fixed'),
    prices: priceRows
      .filter((price) => readString(price, 'plan_id') === id)
      .map((price) => ({
        id: readString(price, 'id') ?? '',
        interval: readEnum(price, 'billing_interval', BILLING_INTERVALS, 'monthly'),
        currency: readString(price, 'currency') ?? 'USD',
        amount: readAmount(price, 'amount'),
        compareAtAmount:
          price['compare_at_amount'] === null ? null : readAmount(price, 'compare_at_amount'),
      })),
    isPublic: readBoolean(row, 'is_public', true),
    isArchived: readBoolean(row, 'is_archived'),
    isDefaultOnSignup: readBoolean(row, 'is_default_on_signup'),
    subscriberCount: counts.get(id) ?? 0,
  };
}

/**
 * Maps one discount code.
 *
 * @param row Row read from public.coupons.
 * @returns The code the console renders.
 */
function toCoupon(row: DatabaseRow): AdminCoupon {
  return {
    id: readString(row, 'id') ?? '',
    code: readString(row, 'code') ?? '',
    name: readString(row, 'name') ?? '',
    couponType: readEnum(row, 'coupon_type', COUPON_TYPES, 'percentage'),
    value: readAmount(row, 'value'),
    currency: readString(row, 'currency'),
    durationMonths: readNumber(row, 'duration_months'),
    maxRedemptions: readNumber(row, 'max_redemptions'),
    maxRedemptionsPerAccount: readNumber(row, 'max_redemptions_per_account') ?? 1,
    redemptionCount: readNumber(row, 'redemption_count') ?? 0,
    validFrom: readString(row, 'valid_from') ?? '',
    validUntil: readString(row, 'valid_until'),
    isActive: readBoolean(row, 'is_active', true),
    campaignName: readString(row, 'campaign_name'),
  };
}

/**
 * Reads the whole catalogue the platform sells.
 *
 * @returns The plans, their prices and the discount codes.
 */
export async function loadPlanCatalogue(): Promise<PlanCatalogue> {
  const supabase = createServerSupabaseClient();

  const [planResult, priceResult, couponResult, subscriptionResult] = await Promise.all([
    supabase
      .from('subscription_plans')
      .select(
        'id, plan_key, name, tagline, description, is_free, is_public, is_archived, is_default_on_signup, trial_days, badge_label, display_order, limits, features, merchant_of_record_fee_percentage, merchant_of_record_fee_fixed'
      )
      .is('deleted_at', null)
      .order('display_order', { ascending: true }),
    supabase
      .from('plan_prices')
      .select('id, plan_id, billing_interval, currency, amount, compare_at_amount, is_active')
      .is('deleted_at', null),
    supabase
      .from('coupons')
      .select(
        'id, code, name, coupon_type, value, currency, duration_months, max_redemptions, max_redemptions_per_account, redemption_count, valid_from, valid_until, is_active, campaign_name'
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('subscriptions')
      .select('plan_id')
      .is('deleted_at', null)
      .not('status', 'in', '(cancelled,expired)'),
  ]);

  if (planResult.error) {
    logger.error('The plan catalogue could not be read', planResult.error);

    return { plans: [], coupons: [], isDegraded: true };
  }

  const counts = new Map<string, number>();

  for (const row of asRows(subscriptionResult.data)) {
    const planId = readString(row, 'plan_id') ?? '';
    counts.set(planId, (counts.get(planId) ?? 0) + 1);
  }

  const priceRows = asRows(priceResult.data);

  return {
    plans: asRows(planResult.data).map((row) => toAdminPlan(row, priceRows, counts)),
    coupons: asRows(couponResult.data).map(toCoupon),
    isDegraded: Boolean(couponResult.error),
  };
}
