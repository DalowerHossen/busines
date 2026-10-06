// src/features/campaigns/queries/get-campaigns.ts
// Reading the campaigns, the audiences and the reach of one business.

import type {
  MarketingCampaign,
  MarketingReach,
  MarketingSegment,
} from '@/features/campaigns/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface CampaignBoard {
  campaigns: readonly MarketingCampaign[];
  segments: readonly MarketingSegment[];
  reach: MarketingReach;
  /** True when something could not be read. */
  isDegraded: boolean;
}

const EMPTY_REACH: MarketingReach = { subscribed: 0, unsubscribed: 0, clientCount: 0 };

/**
 * Reads everything the campaign screen shows.
 *
 * @param companyId Business being read.
 * @returns The campaigns, the audiences, the reach and whether a read failed.
 */
export async function loadCampaignBoard(companyId: string): Promise<CampaignBoard> {
  const supabase = createServerSupabaseClient();

  const [campaigns, segments, reach] = await Promise.all([
    supabase.rpc('marketing_overview', { p_company_id: companyId }),
    supabase.rpc('marketing_segment_list', { p_company_id: companyId }),
    supabase.rpc('marketing_reach', { p_company_id: companyId }),
  ]);

  if (campaigns.error || segments.error || reach.error) {
    logger.error(
      'The campaign screen could not be read',
      campaigns.error ?? segments.error ?? reach.error,
      { companyId }
    );

    return { campaigns: [], segments: [], reach: EMPTY_REACH, isDegraded: true };
  }

  const totals = isJsonObject(reach.data) ? reach.data : {};

  /**
   * Reads a counter out of the reach document.
   *
   * @param key Field being read.
   * @returns The count, or zero.
   */
  function count(key: string): number {
    const value = totals[key];

    return typeof value === 'number' ? value : Number(value ?? 0) || 0;
  }

  return {
    campaigns: asRows(campaigns.data).map((row) => ({
      campaignId: readString(row, 'campaign_id') ?? '',
      name: readString(row, 'name') ?? '',
      campaignType: readString(row, 'campaign_type') ?? 'broadcast',
      status: readString(row, 'status') ?? 'draft',
      subject: readString(row, 'subject'),
      segmentName: readString(row, 'segment_name'),
      scheduledFor: readString(row, 'scheduled_for'),
      recipientCount: readNumber(row, 'recipient_count') ?? 0,
      deliveredCount: readNumber(row, 'delivered_count') ?? 0,
      openedCount: readNumber(row, 'opened_count') ?? 0,
      clickedCount: readNumber(row, 'clicked_count') ?? 0,
      unsubscribedCount: readNumber(row, 'unsubscribed_count') ?? 0,
      openRate: readAmount(row, 'open_rate'),
      clickRate: readAmount(row, 'click_rate'),
      stepCount: readNumber(row, 'step_count') ?? 0,
      updatedAt: readString(row, 'updated_at') ?? '',
    })),
    segments: asRows(segments.data).map((row) => ({
      segmentId: readString(row, 'segment_id') ?? '',
      name: readString(row, 'name') ?? '',
      description: readString(row, 'description'),
      memberCount: readNumber(row, 'member_count') ?? 0,
      lastCalculatedAt: readString(row, 'last_calculated_at'),
      isActive: readBoolean(row, 'is_active'),
    })),
    reach: {
      subscribed: count('subscribed'),
      unsubscribed: count('unsubscribed'),
      clientCount: count('client_count'),
    },
    isDegraded: false,
  };
}
