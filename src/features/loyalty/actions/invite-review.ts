// src/features/loyalty/actions/invite-review.ts
// Asking the client of a paid invoice what they thought. Nobody is asked
// before they have paid, and nobody is ever asked twice about the same work.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { inviteReviewSchema } from '@/features/loyalty/validation/loyalty';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireWritableCompany, requireSender } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface InviteReviewResult {
  /** Identifier of the invitation, or null when one already existed. */
  requestId: string | null;
}

export const inviteInvoiceReview = createAction(
  inviteReviewSchema,
  async (input): Promise<InviteReviewResult> => {
    const { company } = await requireSender();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('invite_invoice_review', {
      p_invoice_id: input.invoiceId,
    });

    if (error) {
      logger.error('A review invitation could not be raised', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    const requestId = typeof data === 'string' ? data : null;

    if (requestId !== null) {
      await recordAuditEntry({
        action: 'insert',
        entityType: 'review_request',
        entityId: requestId,
        companyId: company.id,
        description: 'Invited a client to review a paid invoice',
        metadata: { invoiceId: input.invoiceId },
      });
    }

    revalidatePath(`${ROUTES.loyalty}/reviews`);

    return { requestId };
  },
  { name: 'inviteInvoiceReview' }
);
