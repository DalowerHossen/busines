// src/features/messaging/actions/request-document-send.ts
// A staff member prepares a document and asks the owner to send it. Nothing
// reaches the client until the owner approves.

'use server';

import { revalidatePath } from 'next/cache';

import { sendDocumentSchema } from '@/features/messaging/validation/messaging';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RequestDocumentSendResult {
  /** Identifier of the request the owner will review. */
  requestId: string;
}

export const requestDocumentSend = createAction(
  sendDocumentSchema,
  async (input): Promise<RequestDocumentSendResult> => {
    const { company } = await requirePermission(
      input.documentKind === 'invoice' ? 'invoices' : 'estimates',
      'create'
    );
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('request_document_send', {
      p_company_id: company.id,
      p_document_kind: input.documentKind,
      p_document_id: input.documentId,
      p_recipient_email: input.recipientEmail,
      p_recipient_name: input.recipientName,
      p_custom_message: input.customMessage,
      p_template_key: input.templateKey,
    });

    if (error) {
      logger.error('Could not raise a send request', error, {
        companyId: company.id,
        documentId: input.documentId,
      });

      throw new AppError('database_failure', 'The request could not be raised. Please try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'send_request',
      entityId: typeof data === 'string' ? data : null,
      companyId: company.id,
      description: `A send to ${input.recipientEmail} was requested.`,
    });

    revalidatePath('/dashboard/messages');

    return { requestId: typeof data === 'string' ? data : '' };
  },
  { name: 'requestDocumentSend' }
);
