// src/features/team/actions/set-member-status.ts
// Suspending, reinstating or removing a staff account. Nothing is ever
// destroyed: a removed account is closed and kept for the audit trail.

'use server';

import { revalidatePath } from 'next/cache';

import { setMemberStatusSchema } from '@/features/team/validation/team';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface SetMemberStatusResult {
  /** Identifier of the member that was changed. */
  memberId: string;
  /** The status the account now holds. */
  status: 'active' | 'suspended' | 'closed';
}

export const setMemberStatus = createAction(
  setMemberStatusSchema,
  async (input): Promise<SetMemberStatusResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    if (input.memberId === user.id) {
      throw new AppError('validation_failed', 'You cannot change your own access this way.');
    }

    const supabase = createServerSupabaseClient();

    const { data: member, error: lookupError } = await supabase
      .from('users')
      .select('id, role, full_name')
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

    if (row['role'] === 'owner') {
      throw new AppError('forbidden', 'The owner account cannot be suspended or removed here.');
    }

    const now = new Date().toISOString();
    const changes: Record<string, Json> =
      input.action === 'suspend'
        ? {
            status: 'suspended',
            suspended_at: now,
            suspension_reason: input.reason ?? 'Suspended by the owner.',
            updated_by: user.id,
          }
        : input.action === 'reactivate'
          ? {
              status: 'active',
              suspended_at: null,
              suspension_reason: null,
              updated_by: user.id,
            }
          : {
              status: 'closed',
              suspended_at: now,
              suspension_reason: input.reason ?? 'Removed from the business by the owner.',
              deleted_at: now,
              updated_by: user.id,
            };

    const { error } = await supabase
      .from('users')
      .update(changes)
      .eq('id', input.memberId)
      .eq('company_id', company.id);

    if (error) {
      logger.error('Could not change that account', error, { companyId: company.id });

      throw new AppError('database_failure', 'The account could not be changed.');
    }

    const descriptions = {
      suspend: 'Staff account suspended.',
      reactivate: 'Staff account reinstated.',
      remove: 'Staff account removed from the business.',
    } as const;

    await recordAuditEntry({
      action: input.action === 'remove' ? 'soft_delete' : 'update',
      entityType: 'user',
      entityId: input.memberId,
      companyId: company.id,
      description: descriptions[input.action],
    });

    revalidatePath('/dashboard/team');

    return {
      memberId: input.memberId,
      status:
        input.action === 'suspend'
          ? 'suspended'
          : input.action === 'reactivate'
            ? 'active'
            : 'closed',
    };
  },
  { name: 'setMemberStatus' }
);
