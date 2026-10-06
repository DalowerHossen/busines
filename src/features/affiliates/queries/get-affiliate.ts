// src/features/affiliates/queries/get-affiliate.ts
// Everything a referral partner is allowed to see, read in one pass. The row
// level policies already keep a partner inside its own records; this file
// simply never asks for anything else.

import type {
  AffiliateClickDay,
  AffiliateCommission,
  AffiliateLink,
  AffiliatePayout,
  AffiliateProfile,
  AffiliateSummary,
  AffiliateWorkspace,
} from '@/features/affiliates/types';
import { logger } from '@/lib/logger';
import {
  asRow,
  asRows,
  readAmount,
  readBoolean,
  readEnum,
  readNumber,
  readString,
} from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { AFFILIATE_STATUSES, PAYOUT_STATUSES } from '@/types/enums';

const PROFILE_COLUMNS =
  'id, user_id, referral_code, display_name, status, contact_email, website, promotion_method, country_code, commission_percentage, commission_duration_months, cookie_window_days, minimum_payout_amount, payout_currency, rejection_reason, suspension_reason, approved_at, created_at';

/**
 * Maps the partner record.
 *
 * @param row Row read from public.affiliates.
 * @returns The profile the portal renders.
 */
function toProfile(row: DatabaseRow): AffiliateProfile {
  return {
    id: readString(row, 'id') ?? '',
    userId: readString(row, 'user_id') ?? '',
    referralCode: readString(row, 'referral_code') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    status: readEnum(row, 'status', AFFILIATE_STATUSES, 'pending_review'),
    contactEmail: readString(row, 'contact_email') ?? '',
    website: readString(row, 'website'),
    promotionMethod: readString(row, 'promotion_method'),
    countryCode: readString(row, 'country_code'),
    commissionPercentage: readAmount(row, 'commission_percentage'),
    commissionDurationMonths: readNumber(row, 'commission_duration_months'),
    cookieWindowDays: readNumber(row, 'cookie_window_days') ?? 60,
    minimumPayoutAmount: readAmount(row, 'minimum_payout_amount'),
    payoutCurrency: readString(row, 'payout_currency') ?? 'USD',
    rejectionReason: readString(row, 'rejection_reason'),
    suspensionReason: readString(row, 'suspension_reason'),
    approvedAt: readString(row, 'approved_at'),
    createdAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Maps the figures routine.
 *
 * @param row Row returned by public.affiliate_summary.
 * @returns The summary the portal renders.
 */
function toSummary(row: DatabaseRow): AffiliateSummary {
  return {
    clicksLast30Days: readNumber(row, 'clicks_last_30_days') ?? 0,
    clicksTotal: readNumber(row, 'clicks_total') ?? 0,
    signupsTotal: readNumber(row, 'signups_total') ?? 0,
    pendingAmount: readAmount(row, 'pending_amount'),
    approvedAmount: readAmount(row, 'approved_amount'),
    reversedAmount: readAmount(row, 'reversed_amount'),
    walletAvailable: readAmount(row, 'wallet_available'),
    walletPending: readAmount(row, 'wallet_pending'),
    payoutCurrency: readString(row, 'payout_currency') ?? 'USD',
    minimumPayoutAmount: readAmount(row, 'minimum_payout_amount'),
  };
}

/**
 * Maps one referral link.
 *
 * @param row Row read from public.affiliate_links.
 * @returns The link the portal renders.
 */
function toLink(row: DatabaseRow): AffiliateLink {
  return {
    id: readString(row, 'id') ?? '',
    slug: readString(row, 'slug') ?? '',
    label: readString(row, 'label') ?? '',
    destinationPath: readString(row, 'destination_path') ?? '/',
    campaign: readString(row, 'campaign'),
    clickCount: readNumber(row, 'click_count') ?? 0,
    signupCount: readNumber(row, 'signup_count') ?? 0,
    isActive: readBoolean(row, 'is_active') ?? false,
  };
}

/**
 * Maps one commission.
 *
 * @param row Row read from public.affiliate_commissions.
 * @returns The commission the portal renders.
 */
function toCommission(row: DatabaseRow): AffiliateCommission {
  return {
    id: readString(row, 'id') ?? '',
    amount: readAmount(row, 'amount'),
    currency: readString(row, 'currency') ?? 'USD',
    commissionPercentage: readAmount(row, 'commission_percentage'),
    baseAmount: readAmount(row, 'base_amount'),
    status: readString(row, 'status') ?? 'pending',
    periodStart: readString(row, 'period_start'),
    periodEnd: readString(row, 'period_end'),
    availableOn: readString(row, 'available_on'),
    reversedAt: readString(row, 'reversed_at'),
    createdAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Maps one payout.
 *
 * @param row Row read from public.payouts.
 * @returns The payout the portal renders.
 */
function toPayout(row: DatabaseRow): AffiliatePayout {
  return {
    id: readString(row, 'id') ?? '',
    payoutNumber: readString(row, 'payout_number'),
    status: readEnum(row, 'status', PAYOUT_STATUSES, 'requested'),
    amount: readAmount(row, 'amount'),
    feeAmount: readAmount(row, 'fee_amount'),
    netAmount: readAmount(row, 'net_amount'),
    currency: readString(row, 'currency') ?? 'USD',
    requestedAt: readString(row, 'requested_at') ?? '',
  };
}

/**
 * Groups recent visits into days so the portal can draw a simple trend.
 *
 * @param rows Click rows, newest first.
 * @returns One entry per day with visits, oldest day first.
 */
function toTraffic(rows: readonly DatabaseRow[]): readonly AffiliateClickDay[] {
  const byDay = new Map<string, number>();

  for (const row of rows) {
    const stamp = readString(row, 'created_at') ?? '';
    const day = stamp.slice(0, 10);

    if (day.length === 10) {
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
  }

  return [...byDay.entries()]
    .map(([day, clicks]) => ({ day, clicks }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

/**
 * Reads the whole referral workspace for one account.
 *
 * @param userId Account signed in.
 * @returns The partner record and its figures, or an empty workspace.
 */
export async function loadAffiliateWorkspace(userId: string): Promise<AffiliateWorkspace> {
  const supabase = createServerSupabaseClient();
  const empty: AffiliateWorkspace = {
    profile: null,
    summary: null,
    links: [],
    commissions: [],
    payouts: [],
    recentTraffic: [],
    isDegraded: false,
  };

  const { data, error } = await supabase
    .from('affiliates')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    logger.error('The referral record could not be read', error, { userId });

    return { ...empty, isDegraded: true };
  }

  const row = asRow(data);

  if (row === null) {
    return empty;
  }

  const profile = toProfile(row);

  const [summaryResult, linkResult, commissionResult, payoutResult, clickResult] =
    await Promise.all([
      supabase.rpc('affiliate_summary', { p_affiliate_id: profile.id }),
      supabase
        .from('affiliate_links')
        .select('id, slug, label, destination_path, campaign, click_count, signup_count, is_active')
        .eq('affiliate_id', profile.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('affiliate_commissions')
        .select(
          'id, amount, currency, commission_percentage, base_amount, status, period_start, period_end, available_on, reversed_at, created_at'
        )
        .eq('affiliate_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('payouts')
        .select('id, payout_number, status, amount, fee_amount, net_amount, currency, requested_at')
        .eq('requested_by', userId)
        .is('company_id', null)
        .order('requested_at', { ascending: false })
        .limit(20),
      supabase
        .from('affiliate_clicks')
        .select('created_at')
        .eq('affiliate_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

  const summaryRows = asRows(summaryResult.data);
  const summaryRow = summaryRows[0];

  return {
    profile,
    summary: summaryRow === undefined ? null : toSummary(summaryRow),
    links: asRows(linkResult.data).map(toLink),
    commissions: asRows(commissionResult.data).map(toCommission),
    payouts: asRows(payoutResult.data).map(toPayout),
    recentTraffic: toTraffic(asRows(clickResult.data)),
    isDegraded: summaryResult.error !== null,
  };
}
