// src/features/team/actions/invite-member.ts
// Inviting somebody to work in the business. Only a hash of the invitation
// token is stored, so the link in the owner's hands is the only copy.

'use server';

import { revalidatePath } from 'next/cache';

import { ACCOUNTANT_PERMISSIONS, sanitisePermissionMap } from '@/config/permissions';
import { inviteMemberSchema } from '@/features/team/validation/team';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { sha256Hex, randomSecret } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface InviteMemberResult {
  /** Identifier of the stored invitation. */
  invitationId: string;
  /** The one time link the invited person has to open. */
  invitationPath: string;
  /** When the link stops working. */
  expiresAt: string;
}

export const inviteMember = createAction(
  inviteMemberSchema,
  async (input): Promise<InviteMemberResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('company_id', company.id)
      .eq('email', input.email)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) {
      logger.error('Could not check whether that person is already here', lookupError, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'The invitation could not be prepared.');
    }

    if (existing) {
      throw new AppError(
        'conflict',
        'That email address already belongs to somebody in this business.'
      );
    }

    const token = randomSecret(32);
    const permissions =
      input.role === 'accountant'
        ? ACCOUNTANT_PERMISSIONS
        : sanitisePermissionMap(input.permissions);

    const { data, error } = await supabase
      .from('team_invitations')
      .insert({
        company_id: company.id,
        email: input.email,
        full_name: input.fullName,
        role: input.role,
        permissions,
        token_hash: sha256Hex(token),
        invited_by: user.id,
        message: input.message,
        created_by: user.id,
      })
      .select('id, expires_at')
      .single();

    if (error || !data) {
      logger.error('Could not store the invitation', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The invitation could not be created. There may already be one waiting for that address.'
      );
    }

    const row: Record<string, unknown> = data;

    await recordAuditEntry({
      action: 'insert',
      entityType: 'team_invitation',
      entityId: typeof row['id'] === 'string' ? row['id'] : null,
      companyId: company.id,
      description: `Invited ${input.email} as ${input.role}.`,
    });

    revalidatePath('/dashboard/team');

    return {
      invitationId: typeof row['id'] === 'string' ? row['id'] : '',
      invitationPath: `/register?invitation=${token}`,
      expiresAt: typeof row['expires_at'] === 'string' ? row['expires_at'] : '',
    };
  },
  { name: 'inviteMember' }
);
