// src/features/team/actions/revoke-invitation.ts
// Withdrawing an invitation. The stored hash stops matching, so the link that
// was sent out can never be used again.

'use server';

import { revalidatePath } from 'next/cache';

import { invitationIdSchema } from '@/features/team/validation/team';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RevokeInvitationResult {
  /** Identifier of the invitation that was withdrawn. */
  invitationId: string;
}

export const revokeInvitation = createAction(
  invitationIdSchema,
  async (input): Promise<RevokeInvitationResult> => {
    const { user, company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('team_invitations')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', input.invitationId)
      .eq('company_id', company.id)
      .eq('status', 'pending');

    if (error) {
      logger.error('Could not withdraw the invitation', error, { companyId: company.id });

      throw new AppError('database_failure', 'The invitation could not be withdrawn.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'team_invitation',
      entityId: input.invitationId,
      companyId: company.id,
      description: 'Invitation withdrawn.',
    });

    revalidatePath('/dashboard/team');

    return { invitationId: input.invitationId };
  },
  { name: 'revokeInvitation' }
);
