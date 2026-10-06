// src/features/team/actions/update-member-access.ts
// Changing what a staff member may do. The owner's own access is never
// narrowed here, and only staff accounts carry granular permissions.

'use server';

import { revalidatePath } from 'next/cache';

import { sanitisePermissionMap } from '@/config/permissions';
import { updateMemberAccessSchema } from '@/features/team/validation/team';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateMemberAccessResult {
  /** Identifier of the member whose access was changed. */
  memberId: string;
}

export const updateMemberAccess = createAction(
  updateMemberAccessSchema,
  async (input): Promise<UpdateMemberAccessResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: member, error: lookupError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', input.memberId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) {
      logger.error('Could not read that team member', lookupError, { companyId: company.id });

      throw new AppError('database_failure', 'That person could not be read.');
    }

    if (!member) {
      throw new AppError('not_found', 'That person is not part of this business.');
    }

    const row: Record<string, unknown> = member;

    if (row['role'] !== 'staff') {
      throw new AppError('validation_failed', 'Only a staff account carries detailed permissions.');
    }

    const { error } = await supabase
      .from('users')
      .update({
        job_title: input.jobTitle,
        permissions: sanitisePermissionMap(input.permissions),
        updated_by: user.id,
      })
      .eq('id', input.memberId)
      .eq('company_id', company.id);

    if (error) {
      logger.error('Could not save the permissions', error, { companyId: company.id });

      throw new AppError('database_failure', 'The permissions could not be saved.');
    }

    await recordAuditEntry({
      action: 'permission_change',
      entityType: 'user',
      entityId: input.memberId,
      companyId: company.id,
      description: 'Staff permissions updated.',
    });

    revalidatePath('/dashboard/team');

    return { memberId: input.memberId };
  },
  { name: 'updateMemberAccess' }
);
