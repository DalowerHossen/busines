// src/features/contracts/actions/send-contract.ts
// Sending an agreement out for signature. This is a client facing send, so
// only the owner may do it. Each party gets their own signed link, which is
// what makes the trail worth anything afterwards.

'use server';

import { revalidatePath } from 'next/cache';

import { clientEnv } from '@/lib/env/env.client';
import { loadContract } from '@/features/contracts/queries/get-contract';
import { sendContractSchema } from '@/features/contracts/validation/contracts';
import { issueDocumentLink } from '@/features/portal/services/issue-document-link';
import { ROUTES } from '@/config/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { formatDate } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SendContractResult {
  /** How many invitations went out. */
  invitedCount: number;
}

export const sendContract = createAction(
  sendContractSchema,
  async (input): Promise<SendContractResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error: sendError } = await supabase.rpc('send_contract', {
      p_contract_id: input.contractId,
      p_valid_until: input.validUntil ?? null,
    });

    if (sendError) {
      logger.error('An agreement could not be sent', sendError, { companyId: company.id });

      throw new AppError('database_failure', sendError.message);
    }

    const contract = await loadContract(input.contractId);

    if (contract === null) {
      throw new AppError('not_found', 'That agreement could not be read back after sending.');
    }

    const baseUrl = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
    let invitedCount = 0;

    for (const signer of contract.signers) {
      const link = await issueDocumentLink(supabase, {
        companyId: company.id,
        documentKind: 'contract',
        documentId: contract.contractId,
        recipientEmail: signer.email,
        createdBy: user.id,
      });

      const { error: attachError } = await supabase.rpc('attach_signer_invitation', {
        p_signer_id: signer.signerId,
        p_link_id: link.linkId,
      });

      if (attachError) {
        logger.error('An invitation could not be tied to its party', attachError, {
          companyId: company.id,
          contractId: contract.contractId,
        });

        continue;
      }

      const { error: queueError } = await supabase.rpc('queue_message', {
        p_company_id: company.id,
        p_template_key: 'contract_signature_request',
        p_to_email: signer.email,
        p_variables: {
          client_name: signer.fullName,
          company_name: company.displayName,
          contract_title: contract.title,
          contract_number: contract.contractNumber,
          document_url: `${baseUrl}${ROUTES.clientSigning}/${link.token}`,
          valid_until: formatDate(contract.validUntil ?? input.validUntil ?? ''),
        },
        p_to_name: signer.fullName,
        p_related_entity_type: 'contract',
        p_related_entity_id: contract.contractId,
        p_client_id: contract.clientId,
      });

      if (queueError) {
        logger.warn('An invitation email could not be queued', {
          companyId: company.id,
          contractId: contract.contractId,
        });
      }

      invitedCount += 1;
    }

    await recordAuditEntry({
      action: 'send',
      entityType: 'contract',
      entityId: contract.contractId,
      companyId: company.id,
      description: `${contract.contractNumber} was sent to ${invitedCount} parties for signature.`,
    });

    revalidatePath(ROUTES.contracts);
    revalidatePath(`${ROUTES.contracts}/${contract.contractId}`);

    return { invitedCount };
  },
  { name: 'sendContract' }
);
