// src/features/messaging/queries/list-channels.ts
// Reading the channels a business can send on, its own first and the shared
// ones underneath.

import type { MessagingChannelRecord, OutboundChannelName } from '@/features/messaging/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

const CHANNEL_NAMES: readonly OutboundChannelName[] = ['sms', 'whatsapp', 'telegram', 'viber'];

export interface ChannelListResult {
  channels: readonly MessagingChannelRecord[];
  /** True when the list could not be read and the page is showing nothing. */
  isDegraded: boolean;
}

/**
 * Maps one row of the channel list.
 *
 * @param row Row returned by the database routine.
 * @returns The channel the interface renders.
 */
function toChannel(row: DatabaseRow): MessagingChannelRecord {
  const name = readString(row, 'channel') ?? 'sms';

  return {
    channelId: readString(row, 'channel_id') ?? '',
    channel: CHANNEL_NAMES.includes(name as OutboundChannelName)
      ? (name as OutboundChannelName)
      : 'sms',
    provider: readString(row, 'provider') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    senderNumber: readString(row, 'sender_number'),
    senderHandle: readString(row, 'sender_handle'),
    isPlatformChannel: readBoolean(row, 'is_platform_channel') ?? false,
    isActive: readBoolean(row, 'is_active') ?? false,
    isVerified: readBoolean(row, 'is_verified') ?? false,
    routingPriority: readNumber(row, 'routing_priority') ?? 100,
    costPerMessage: readString(row, 'cost_per_message') ?? '0',
    costCurrency: readString(row, 'cost_currency') ?? 'USD',
    dailySendLimit: readNumber(row, 'daily_send_limit'),
    sentToday: readNumber(row, 'sent_today') ?? 0,
    quietHoursStart: readString(row, 'quiet_hours_start'),
    quietHoursEnd: readString(row, 'quiet_hours_end'),
    lastUsedAt: readString(row, 'last_used_at'),
    lastError: readString(row, 'last_error'),
  };
}

/**
 * Reads the channels one business can send on.
 *
 * @param companyId Business whose channels are being read.
 * @returns The channels, and whether the read failed.
 */
export async function loadMessagingChannels(companyId: string): Promise<ChannelListResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('company_messaging_channels', {
    p_company_id: companyId,
  });

  if (error) {
    logger.error('The messaging channels could not be read', error, { companyId });

    return { channels: [], isDegraded: true };
  }

  return { channels: asRows(data).map(toChannel), isDegraded: false };
}
