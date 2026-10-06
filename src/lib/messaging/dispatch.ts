// src/lib/messaging/dispatch.ts
// Sending one message on a channel that is not email. The worker has already
// claimed the message; this decides which sender it belongs to, asks the
// provider to deliver it, and reports what happened so the fallback chain
// knows whether to try the next channel.

import 'server-only';

import { logger } from '@/lib/logger';
import { resolveChannelCredentials } from '@/lib/messaging/credentials';
import { isOutboundChannel, messagingAdapterFor } from '@/lib/messaging/providers/registry';
import type { ChannelSendOutcome } from '@/lib/messaging/providers/types';
import { asRow, readJson, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface ChannelMessage {
  /** Identifier of the message in the outbox. */
  id: string;
  /** The business the message belongs to. */
  companyId: string;
  /** Channel recorded on the message. */
  channel: string;
  /** Where it is going. */
  toAddress: string | null;
  /** The words themselves. */
  bodyText: string | null;
}

/**
 * Sends one queued message on a channel other than email.
 *
 * @param message The claimed message.
 * @returns What the provider did with it.
 */
export async function sendChannelMessage(message: ChannelMessage): Promise<ChannelSendOutcome> {
  if (!isOutboundChannel(message.channel)) {
    return {
      status: 'failed',
      reason: 'That channel cannot be sent on from here.',
      isPermanent: true,
    };
  }

  if (!message.toAddress || !message.bodyText) {
    return {
      status: 'failed',
      reason: 'The message has no recipient or nothing to say.',
      isPermanent: true,
    };
  }

  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('resolve_messaging_channel', {
    p_company_id: message.companyId,
    p_channel: message.channel,
  });

  const channelId = typeof data === 'string' ? data : null;

  if (error || channelId === null) {
    return {
      status: 'not_configured',
      reason: 'No verified sender is configured for that channel.',
    };
  }

  const { data: channelRow, error: channelError } = await supabase
    .from('messaging_channels')
    .select('provider, sender_number, sender_handle, credential_id, adapter_settings')
    .eq('id', channelId)
    .maybeSingle();

  const row = asRow(channelRow);

  if (channelError || row === null) {
    return { status: 'not_configured', reason: 'The sender for that channel has gone.' };
  }

  const provider = readString(row, 'provider') ?? 'configurable';
  const resolved = await resolveChannelCredentials(readString(row, 'credential_id'), provider);

  if (resolved.source === 'none') {
    return {
      status: 'not_configured',
      reason: 'This channel has no credentials yet, so the message is waiting.',
    };
  }

  const adapter = messagingAdapterFor(message.channel, provider);

  const outcome = await adapter.send(
    {
      provider,
      channel: message.channel,
      credentials: resolved.credentials,
      settings: { ...resolved.settings, ...readJson(row, 'adapter_settings') },
      senderAddress: readString(row, 'sender_number') ?? readString(row, 'sender_handle'),
    },
    {
      toAddress: message.toAddress,
      bodyText: message.bodyText,
      reference: message.id,
    }
  );

  if (outcome.status === 'failed') {
    await supabase
      .from('messaging_channels')
      .update({
        last_error: outcome.reason,
        last_error_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    logger.warn('A message could not be handed to its provider', {
      channel: message.channel,
      provider,
    });
  }

  return outcome;
}
