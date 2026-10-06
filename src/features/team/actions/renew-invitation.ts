// src/features/team/actions/renew-invitation.ts
// Issuing a fresh link for an invitation that was never accepted. The old
// link stops working the moment the new one is created.

'use server';

import { revalidatePath } from 'next/cache';

import { invitationIdSchema } from '@/features/team/validation/team';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { randomSecret, sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const FOURTEEN_DAYS_IN_MILLISECONDS = 14 * 24 * 60 * 60 * 1000;

export interface RenewInvitationResult {
  /** Identifier of the invitation. */
  invitationId: string;
  /** The fresh link the invited person has to open. */
  invitationPath: string;
  /** When the new link stops working. */
  expiresAt: string;
}

export const renewInvitation = createAction(
  invitationIdSchema,
  async (input): Promise<RenewInvitationResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const token = randomSecret(32);
    const expiresAt = new Date(Date.now() + FOURTEEN_DAYS_IN_MILLISECONDS).toISOString();

    const { data, error } = await supabase
      .from('team_invitations')
      .update({
        token_hash: sha256Hex(token),
        status: 'pending',
        expires_at: expiresAt,
        reminder_sent_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', input.invitationId)
      .eq('company_id', company.id)
      .in('status', ['pending', 'expired'])
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not refresh the invitation', error, { companyId: company.id });

      throw new AppError('database_failure', 'A new link could not be created.');
    }

    if (!data) {
      throw new AppError('not_found', 'That invitation is no longer waiting to be accepted.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'team_invitation',
      entityId: input.invitationId,
      companyId: company.id,
      description: 'A fresh invitation link was issued.',
    });

    revalidatePath('/dashboard/team');

    return {
      invitationId: input.invitationId,
      invitationPath: `/register?invitation=${token}`,
      expiresAt,
    };
  },
  { name: 'renewInvitation' }
);
