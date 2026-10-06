// src/lib/email/dispatch.ts
// Draining the outbox. A worker claims the messages that are due, hands each
// one to the provider and writes back what happened, so a message is never
// sent twice and a failure is always visible.

import 'server-only';

import { sendEmail } from '@/lib/email/transport';
import { logger } from '@/lib/logger';
import { sendChannelMessage } from '@/lib/messaging/dispatch';
import { asRows, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface DispatchSummary {
  /** How many messages were claimed from the queue. */
  claimed: number;
  /** How many the provider accepted. */
  sent: number;
  /** How many the provider refused, and will be retried unless permanent. */
  failed: number;
  /** How many were left in the queue because no provider is configured. */
  deferred: number;
}

/**
 * Sends the messages that are due to go out.
 *
 * @param limit How many messages to attempt in one run.
 * @returns What happened to the batch.
 */
export async function dispatchDueMessages(limit = 25): Promise<DispatchSummary> {
  const supabase = getServiceSupabaseClient();
  const summary: DispatchSummary = { claimed: 0, sent: 0, failed: 0, deferred: 0 };

  // A worker that died mid batch leaves messages marked as being sent.
  // They are put back before anything new is claimed, because a message
  // nobody will ever retry is the worst outcome available here.
  const { error: requeueError } = await supabase.rpc('requeue_stalled_messages', {
    p_stalled_minutes: 15,
    p_max_attempts: 5,
  });

  if (requeueError) {
    logger.warn('Stalled messages could not be put back', { message: requeueError.message });
  }

  const { data, error } = await supabase.rpc('claim_due_messages', { p_limit: limit });

  if (error) {
    logger.error('Could not claim messages from the outbox', error, { limit });
    return summary;
  }

  const messages = asRows(data);
  summary.claimed = messages.length;

  /**
   * Sends one message and records what happened to it.
   *
   * It is its own function so that one message behaving unexpectedly
   * cannot abandon the rest of the batch in the sending state, where
   * nothing would ever retry them.
   *
   * @param message The claimed message row.
   * @returns Nothing; the summary is updated as it goes.
   */
  async function sendOne(message: DatabaseRow): Promise<void> {
    const messageId = readString(message, 'id') ?? '';
    const channel = readString(message, 'channel') ?? 'email';

    if (channel !== 'email') {
      // A text message or a chat message is handed to its own provider, and
      // the fallback chain is told at once whether it landed.
      const channelOutcome = await sendChannelMessage({
        id: messageId,
        companyId: readString(message, 'company_id') ?? '',
        channel,
        toAddress: readString(message, 'to_phone') ?? readString(message, 'to_email'),
        bodyText: readString(message, 'body_text'),
      });

      if (channelOutcome.status === 'not_configured') {
        await supabase
          .from('messages')
          .update({ status: 'queued', next_attempt_at: null })
          .eq('id', messageId);

        summary.deferred += 1;
        return;
      }

      if (channelOutcome.status === 'failed') {
        await supabase.rpc('record_message_event', {
          p_message_id: messageId,
          p_event: channelOutcome.isPermanent ? 'bounced' : 'failed',
          p_detail: { reason: channelOutcome.reason },
        });

        summary.failed += 1;
        return;
      }

      if (channelOutcome.providerMessageId) {
        await supabase
          .from('messages')
          .update({ provider_message_id: channelOutcome.providerMessageId })
          .eq('id', messageId);
      }

      await supabase.rpc('record_message_event', {
        p_message_id: messageId,
        p_event: 'sent',
        p_detail: { channel },
      });

      summary.sent += 1;
      return;
    }

    const toEmail = readString(message, 'to_email');
    const fromEmail = readString(message, 'from_email');
    const subject = readString(message, 'subject');

    if (!messageId || !toEmail || !fromEmail || !subject) {
      await supabase.rpc('record_message_event', {
        p_message_id: messageId,
        p_event: 'failed',
        p_detail: { reason: 'The message is missing an address or a subject.' },
      });

      summary.failed += 1;
      return;
    }

    const outcome = await sendEmail({
      fromName: readString(message, 'from_name'),
      fromEmail,
      replyToEmail: readString(message, 'reply_to_email'),
      toEmail,
      toName: readString(message, 'to_name'),
      subject,
      bodyHtml: readString(message, 'body_html'),
      bodyText: readString(message, 'body_text'),
    });

    if (outcome.status === 'not_configured') {
      // The message goes back to the queue untouched, so nothing is lost while
      // the provider key is still being set up.
      await supabase
        .from('messages')
        .update({ status: 'queued', next_attempt_at: null })
        .eq('id', messageId);

      summary.deferred += 1;
      return;
    }

    if (outcome.status === 'failed') {
      await supabase.rpc('record_message_event', {
        p_message_id: messageId,
        p_event: outcome.isPermanent ? 'bounced' : 'failed',
        p_detail: { reason: outcome.reason },
      });

      summary.failed += 1;
      return;
    }

    if (outcome.providerMessageId) {
      await supabase
        .from('messages')
        .update({ provider: 'resend', provider_message_id: outcome.providerMessageId })
        .eq('id', messageId);
    }

    await supabase.rpc('record_message_event', {
      p_message_id: messageId,
      p_event: 'sent',
      p_detail: { provider: 'resend' },
    });

    summary.sent += 1;
  }

  for (const message of messages) {
    try {
      await sendOne(message);
    } catch (cause) {
      const messageId = readString(message, 'id') ?? '';

      logger.error('A message could not be sent', cause, { messageId });

      await supabase.rpc('record_message_event', {
        p_message_id: messageId,
        p_event: 'failed',
        p_detail: { reason: cause instanceof Error ? cause.message : 'unknown' },
      });

      summary.failed += 1;
    }
  }

  return summary;
}
