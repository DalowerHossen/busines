// src/features/messaging/queries/list-inbound.ts
// Reading the replies nobody has dealt with yet. A reply is how a client says
// stop, and how a conversation continues, so neither can be left unread.

import type { InboundReplyRecord } from '@/features/messaging/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface InboundResult {
  replies: readonly InboundReplyRecord[];
  /** True when the list could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the replies waiting for somebody at one business.
 *
 * @param companyId Business whose replies are being read.
 * @param limit How many replies to read.
 * @returns The replies, and whether the read failed.
 */
export async function loadPendingReplies(companyId: string, limit = 50): Promise<InboundResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('pending_inbound_messages', {
    p_company_id: companyId,
    p_limit: limit,
  });

  if (error) {
    logger.error('The incoming replies could not be read', error, { companyId });

    return { replies: [], isDegraded: true };
  }

  const replies = asRows(data).map((row) => ({
    inboundId: readString(row, 'inbound_id') ?? '',
    channel: readString(row, 'channel') ?? 'sms',
    fromAddress: readString(row, 'from_address') ?? '',
    bodyText: readString(row, 'body_text'),
    clientName: readString(row, 'client_name'),
    isOptOut: readBoolean(row, 'is_opt_out') ?? false,
    receivedAt: readString(row, 'received_at') ?? '',
  }));

  return { replies, isDegraded: false };
}
