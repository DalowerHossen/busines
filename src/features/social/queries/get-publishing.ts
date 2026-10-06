// src/features/social/queries/get-publishing.ts
// Reading the accounts, the calendar and the rules of one business.

import type { SocialChannel, SocialPost, SocialRule } from '@/features/social/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface PublishingBoard {
  channels: readonly SocialChannel[];
  posts: readonly SocialPost[];
  rules: readonly SocialRule[];
  /** True when something could not be read. */
  isDegraded: boolean;
}

/**
 * Reads everything the publishing screen shows.
 *
 * @param companyId Business being read, or null for the platform itself.
 * @returns The accounts, the posts, the rules and whether a read failed.
 */
export async function loadPublishingBoard(companyId: string | null): Promise<PublishingBoard> {
  const supabase = createServerSupabaseClient();

  const [channels, posts, rules] = await Promise.all([
    supabase.rpc('social_channel_list', { p_company_id: companyId }),
    supabase.rpc('social_post_list', { p_company_id: companyId, p_limit: 50 }),
    supabase.rpc('social_rule_list', { p_company_id: companyId }),
  ]);

  if (channels.error || posts.error || rules.error) {
    logger.error(
      'The publishing screen could not be read',
      channels.error ?? posts.error ?? rules.error,
      { companyId }
    );

    return { channels: [], posts: [], rules: [], isDegraded: true };
  }

  return {
    channels: asRows(channels.data).map((row) => ({
      channelId: readString(row, 'channel_id') ?? '',
      platform: readString(row, 'platform') ?? '',
      accountName: readString(row, 'account_name') ?? '',
      accountHandle: readString(row, 'account_handle'),
      isConnected: readBoolean(row, 'is_connected'),
      isActive: readBoolean(row, 'is_active'),
      maskedHint: readString(row, 'masked_hint'),
      tokenExpiresAt: readString(row, 'token_expires_at'),
      connectionError: readString(row, 'connection_error'),
      lastPublishedAt: readString(row, 'last_published_at'),
      postCount: readNumber(row, 'post_count') ?? 0,
    })),
    posts: asRows(posts.data).map((row) => ({
      postId: readString(row, 'post_id') ?? '',
      title: readString(row, 'title') ?? '',
      body: readString(row, 'body') ?? '',
      linkUrl: readString(row, 'link_url'),
      status: readString(row, 'status') ?? 'draft',
      scheduledFor: readString(row, 'scheduled_for'),
      publishedAt: readString(row, 'published_at'),
      approvedAt: readString(row, 'approved_at'),
      channelCount: readNumber(row, 'channel_count') ?? 0,
      publishedCount: readNumber(row, 'published_count') ?? 0,
      failedCount: readNumber(row, 'failed_count') ?? 0,
      createdAt: readString(row, 'created_at') ?? '',
    })),
    rules: asRows(rules.data).map((row) => ({
      ruleId: readString(row, 'rule_id') ?? '',
      name: readString(row, 'name') ?? '',
      triggerEvent: readString(row, 'trigger_event') ?? '',
      bodyTemplate: readString(row, 'body_template') ?? '',
      channelCount: readNumber(row, 'channel_count') ?? 0,
      requiresApproval: readBoolean(row, 'requires_approval'),
      minimumHoursBetweenPosts: readNumber(row, 'minimum_hours_between_posts') ?? 24,
      isActive: readBoolean(row, 'is_active'),
      lastTriggeredAt: readString(row, 'last_triggered_at'),
      triggerCount: readNumber(row, 'trigger_count') ?? 0,
    })),
    isDegraded: false,
  };
}
