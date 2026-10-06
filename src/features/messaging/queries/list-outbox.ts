// src/features/messaging/queries/list-outbox.ts
// Reading what this business has sent to its clients, what is still waiting
// to go, and what a colleague has asked the owner to approve.

import type {
  OutboxMessage,
  OutboxOverview,
  OutboxTotals,
  SendRequest,
} from '@/features/messaging/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readEnum, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { APPROVAL_STATUSES, MESSAGE_STATUSES } from '@/types/enums';

const MESSAGE_COLUMNS =
  'id, status, template_key, to_email, to_name, subject, related_entity_type, related_entity_id, created_at, scheduled_for, sent_at, failure_reason, open_count, attempt_count';

const REQUEST_COLUMNS =
  'id, document_kind, document_id, template_key, recipient_email, recipient_name, custom_message, status, requested_at, decline_reason, requested_by, users!send_requests_requested_by_fkey(full_name)';

/** How many recent messages the outbox shows at once. */
const MESSAGE_LIMIT = 50;

/**
 * Maps one row of the outbox.
 *
 * @param row Row read from public.messages.
 * @returns The message the table renders.
 */
function toMessage(row: DatabaseRow): OutboxMessage {
  return {
    id: readString(row, 'id') ?? '',
    status: readEnum(row, 'status', MESSAGE_STATUSES, 'queued'),
    templateKey: readString(row, 'template_key'),
    toEmail: readString(row, 'to_email') ?? '',
    toName: readString(row, 'to_name'),
    subject: readString(row, 'subject') ?? '',
    relatedEntityType: readString(row, 'related_entity_type'),
    relatedEntityId: readString(row, 'related_entity_id'),
    createdAt: readString(row, 'created_at') ?? '',
    scheduledFor: readString(row, 'scheduled_for'),
    sentAt: readString(row, 'sent_at'),
    failureReason: readString(row, 'failure_reason'),
    openCount: readNumber(row, 'open_count') ?? 0,
    attemptCount: readNumber(row, 'attempt_count') ?? 0,
  };
}

/**
 * Maps one request a colleague raised.
 *
 * @param row Row read from public.send_requests.
 * @returns The request the table renders.
 */
function toRequest(row: DatabaseRow): SendRequest {
  const requester = asRow(row['users']);

  return {
    id: readString(row, 'id') ?? '',
    documentKind: readString(row, 'document_kind') ?? 'invoice',
    documentId: readString(row, 'document_id') ?? '',
    templateKey: readString(row, 'template_key') ?? 'invoice_sent',
    recipientEmail: readString(row, 'recipient_email') ?? '',
    recipientName: readString(row, 'recipient_name'),
    customMessage: readString(row, 'custom_message'),
    status: readEnum(row, 'status', APPROVAL_STATUSES, 'pending'),
    requestedAt: readString(row, 'requested_at') ?? '',
    requestedByName: requester === null ? null : readString(requester, 'full_name'),
    declineReason: readString(row, 'decline_reason'),
  };
}

/**
 * Counts the messages by the state they are in.
 *
 * @param messages Messages read from the outbox.
 * @param pendingRequests How many requests are waiting for the owner.
 * @returns The figures shown above the tables.
 */
function summarise(messages: readonly OutboxMessage[], pendingRequests: number): OutboxTotals {
  return {
    queued: messages.filter((message) =>
      ['queued', 'scheduled', 'sending'].includes(message.status)
    ).length,
    sent: messages.filter((message) => ['sent', 'delivered', 'read'].includes(message.status))
      .length,
    failed: messages.filter((message) =>
      ['failed', 'bounced', 'complained', 'suppressed'].includes(message.status)
    ).length,
    pendingRequests,
  };
}

/**
 * Reads the outbox of one business.
 *
 * @param companyId Company whose messages are read.
 * @returns The messages, the requests and the figures above them.
 */
export async function loadOutbox(companyId: string): Promise<OutboxOverview> {
  const supabase = createServerSupabaseClient();

  const [messageResult, requestResult] = await Promise.all([
    supabase
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_LIMIT),
    supabase
      .from('send_requests')
      .select(REQUEST_COLUMNS)
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false })
      .limit(MESSAGE_LIMIT),
  ]);

  if (messageResult.error || requestResult.error) {
    logger.error(
      'Could not read the outbox of this business',
      messageResult.error ?? requestResult.error,
      { companyId }
    );

    return {
      messages: [],
      requests: [],
      totals: { queued: 0, sent: 0, failed: 0, pendingRequests: 0 },
      isDegraded: true,
    };
  }

  const messages = asRows(messageResult.data).map(toMessage);
  const requests = asRows(requestResult.data).map(toRequest);
  const pending = requests.filter((request) => request.status === 'pending').length;

  return {
    messages,
    requests,
    totals: summarise(messages, pending),
    isDegraded: false,
  };
}
