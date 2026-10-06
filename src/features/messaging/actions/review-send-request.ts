// src/features/messaging/actions/review-send-request.ts
// The owner approves or declines what a colleague prepared. Approving sends
// the document straight away; declining says why.

'use server';

import { revalidatePath } from 'next/cache';

import { sendDocument } from '@/features/messaging/actions/send-document';
import { reviewSendRequestSchema } from '@/features/messaging/validation/messaging';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewSendRequestResult {
  /** Identifier of the request that was reviewed. */
  requestId: string;
  /** True when the document was sent as a result. */
  wasSent: boolean;
}

export const reviewSendRequest = createAction(
  reviewSendRequestSchema,
  async (input): Promise<ReviewSendRequestResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { data: request, error: lookupError } = await supabase
      .from('send_requests')
      .select(
        'id, document_kind, document_id, recipient_email, recipient_name, template_key, custom_message'
      )
      .eq('id', input.requestId)
      .eq('company_id', company.id)
      .eq('status', 'pending')
      .maybeSingle();

    const row = asRow(request);

    if (lookupError || row === null) {
      throw new AppError('not_found', 'That request has already been dealt with.');
    }

    if (!input.approve && input.reason === null) {
      throw new AppError('validation_failed', 'Please say why the request is being declined.');
    }

    const { error } = await supabase.rpc('review_send_request', {
      p_request_id: input.requestId,
      p_approve: input.approve,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('Could not review the send request', error, { companyId: company.id });

      throw new AppError('database_failure', 'The request could not be reviewed.');
    }

    let wasSent = false;

    if (input.approve) {
      const kind = readString(row, 'document_kind');
      const templateKey = readString(row, 'template_key') ?? 'invoice_sent';

      const result = await sendDocument({
        documentKind: kind === 'estimate' ? 'estimate' : 'invoice',
        documentId: readString(row, 'document_id') ?? '',
        recipientEmail: readString(row, 'recipient_email') ?? '',
        recipientName: readString(row, 'recipient_name') ?? undefined,
        templateKey,
        customMessage: readString(row, 'custom_message') ?? undefined,
      });

      wasSent = result.success;

      if (result.success) {
        await supabase
          .from('send_requests')
          .update({ message_id: result.data.messageId, sent_at: new Date().toISOString() })
          .eq('id', input.requestId);
      }
    }

    await recordAuditEntry({
      action: input.approve ? 'approve' : 'reject',
      entityType: 'send_request',
      entityId: input.requestId,
      companyId: company.id,
      description: input.approve
        ? 'A send request was approved.'
        : `A send request was declined: ${input.reason ?? 'no reason given'}.`,
    });

    revalidatePath('/dashboard/messages');

    return { requestId: input.requestId, wasSent };
  },
  { name: 'reviewSendRequest' }
);
