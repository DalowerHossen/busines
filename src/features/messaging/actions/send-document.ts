// src/features/messaging/actions/send-document.ts
// Sending one document to a client. Only the owner may do this; a staff
// member raises a request instead, which the owner approves.
//
// The message is rendered and queued inside the database, which is also where
// the do not contact list and the owner only rule are enforced, so a message
// can never leave by another path.

'use server';

import { revalidatePath } from 'next/cache';

import { sendDocumentSchema } from '@/features/messaging/validation/messaging';
import { issueDocumentLink } from '@/features/portal/services/issue-document-link';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { formatDate } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { logger } from '@/lib/logger';
import { asRow, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { clientEnv } from '@/lib/env/env.client';

export interface SendDocumentResult {
  /** Identifier of the queued message. */
  messageId: string;
  /** Address the document was addressed to. */
  recipientEmail: string;
}

export const sendDocument = createAction(
  sendDocumentSchema,
  async (input): Promise<SendDocumentResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const table = input.documentKind === 'invoice' ? 'invoices' : 'estimates';
    const numberColumn = input.documentKind === 'invoice' ? 'invoice_number' : 'estimate_number';

    const { data, error } = await supabase
      .from(table)
      .select(
        `id, ${numberColumn}, currency, total_amount, client_id, client_name_snapshot, issue_date`
      )
      .eq('company_id', company.id)
      .eq('id', input.documentId)
      .maybeSingle();

    const row = asRow(data);

    if (error || row === null) {
      logger.error('Could not read the document being sent', error, {
        companyId: company.id,
        documentId: input.documentId,
      });

      throw new AppError('not_found', 'That document could not be found.');
    }

    const documentNumber = readString(row, numberColumn);

    if (!documentNumber) {
      throw new AppError(
        'validation_failed',
        'Issue this document before sending it, so it carries a number.'
      );
    }

    const currency = readString(row, 'currency') ?? company.baseCurrency;
    const totalAmount = readAmount(row, 'total_amount');

    const link = await issueDocumentLink(supabase, {
      companyId: company.id,
      documentKind: input.documentKind,
      documentId: input.documentId,
      recipientEmail: input.recipientEmail,
      createdBy: user.id,
    });

    const baseUrl = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');

    const variables: Record<string, string> = {
      client_name: input.recipientName ?? readString(row, 'client_name_snapshot') ?? 'there',
      company_name: company.displayName,
      invoice_number: documentNumber,
      estimate_number: documentNumber,
      total_amount: formatMoney(totalAmount, currency),
      balance_due: formatMoney(totalAmount, currency),
      due_date: formatDate(readString(row, 'issue_date') ?? ''),
      document_url: `${baseUrl}${link.linkPath}`,
      custom_message: input.customMessage ?? '',
    };

    const { data: queued, error: queueError } = await supabase.rpc('queue_message', {
      p_company_id: company.id,
      p_template_key: input.templateKey,
      p_to_email: input.recipientEmail,
      p_variables: variables,
      p_to_name: input.recipientName,
      p_related_entity_type: input.documentKind,
      p_related_entity_id: input.documentId,
      p_client_id: readString(row, 'client_id'),
    });

    if (queueError) {
      logger.error('Could not queue the message', queueError, {
        companyId: company.id,
        documentId: input.documentId,
      });

      throw new AppError(
        'database_failure',
        'The message could not be queued. Check that the address accepts mail and try again.'
      );
    }

    await recordAuditEntry({
      action: 'send',
      entityType: input.documentKind,
      entityId: input.documentId,
      companyId: company.id,
      description: `${documentNumber} was sent to ${input.recipientEmail}.`,
    });

    revalidatePath(`/dashboard/${input.documentKind}s/${input.documentId}`);
    revalidatePath('/dashboard/messages');

    return {
      messageId: typeof queued === 'string' ? queued : '',
      recipientEmail: input.recipientEmail,
    };
  },
  { name: 'sendDocument' }
);
