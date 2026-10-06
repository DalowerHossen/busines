// src/features/admin/queries/list-affiliates.ts
// The referral partners on the platform: who is waiting for a decision, and
// how the approved ones are performing.

import { logger } from '@/lib/logger';
import { asRows, readAmount, readEnum, readNumber, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { DatabaseRow } from '@/types/database';
import { AFFILIATE_STATUSES, type AffiliateStatus } from '@/types/enums';

export interface AffiliateRecord {
  id: string;
  referralCode: string;
  displayName: string;
  contactEmail: string;
  status: AffiliateStatus;
  website: string | null;
  promotionMethod: string | null;
  countryCode: string | null;
  commissionPercentage: string;
  payoutCurrency: string;
  totalClicks: number;
  totalSignups: number;
  totalCommissionEarned: string;
  totalCommissionPaid: string;
  flaggedReferrals: number;
  createdAt: string;
}

export interface AffiliateDirectory {
  /** Applications waiting for a decision. */
  pending: readonly AffiliateRecord[];
  /** Partners already in the programme. */
  active: readonly AffiliateRecord[];
  /** True when the directory could not be read. */
  isDegraded: boolean;
}

const COLUMNS =
  'id, referral_code, display_name, contact_email, status, website, promotion_method, country_code, commission_percentage, payout_currency, total_clicks, total_signups, total_commission_earned, total_commission_paid, created_at';

/**
 * Maps one partner.
 *
 * @param row Row read from public.affiliates.
 * @param flagged Referrals flagged for review against this partner.
 * @returns The record the console renders.
 */
function toRecord(row: DatabaseRow, flagged: number): AffiliateRecord {
  return {
    id: readString(row, 'id') ?? '',
    referralCode: readString(row, 'referral_code') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    contactEmail: readString(row, 'contact_email') ?? '',
    status: readEnum(row, 'status', AFFILIATE_STATUSES, 'pending_review'),
    website: readString(row, 'website'),
    promotionMethod: readString(row, 'promotion_method'),
    countryCode: readString(row, 'country_code'),
    commissionPercentage: readAmount(row, 'commission_percentage'),
    payoutCurrency: readString(row, 'payout_currency') ?? 'USD',
    totalClicks: readNumber(row, 'total_clicks') ?? 0,
    totalSignups: readNumber(row, 'total_signups') ?? 0,
    totalCommissionEarned: readAmount(row, 'total_commission_earned'),
    totalCommissionPaid: readAmount(row, 'total_commission_paid'),
    flaggedReferrals: flagged,
    createdAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Reads every referral partner, split by whether a decision is outstanding.
 *
 * @returns The directory of partners.
 */
export async function loadAffiliateDirectory(): Promise<AffiliateDirectory> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('affiliates')
    .select(COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    logger.error('The referral directory could not be read', error, {});

    return { pending: [], active: [], isDegraded: true };
  }

  const { data: flaggedData } = await supabase
    .from('affiliate_referrals')
    .select('affiliate_id')
    .eq('is_flagged', true);

  const flaggedByAffiliate = new Map<string, number>();

  for (const row of asRows(flaggedData)) {
    const key = readString(row, 'affiliate_id') ?? '';

    flaggedByAffiliate.set(key, (flaggedByAffiliate.get(key) ?? 0) + 1);
  }

  const records = asRows(data).map((row) =>
    toRecord(row, flaggedByAffiliate.get(readString(row, 'id') ?? '') ?? 0)
  );

  return {
    pending: records.filter((record) => record.status === 'pending_review'),
    active: records.filter((record) => record.status !== 'pending_review'),
    isDegraded: false,
  };
}
