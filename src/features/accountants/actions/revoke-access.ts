// src/features/accountants/actions/revoke-access.ts
// Taking access back. The grant is kept and marked revoked rather than
// deleted, so the record of who could read the books, and until when, stays
// intact.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { revokeAccountantAccessSchema } from '@/features/accountants/validation/accountant';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RevokeAccessResult {
  /** True once the grant no longer opens anything. */
  isRevoked: boolean;
}

export const revokeAccountantAccess = createAction(
  revokeAccountantAccessSchema,
  async (input): Promise<RevokeAccessResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('accountant_company_access')
      .select('id, accountant_user_id, status')
      .eq('id', input.grantId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      logger.error('The grant being revoked could not be read', error, { companyId: company.id });

      throw new AppError('database_failure', 'Access could not be changed. Please try again.');
    }

    const grant = asRow(data);

    if (grant === null) {
      throw new AppError('not_found', 'That access grant no longer exists.');
    }

    if (readString(grant, 'status') === 'revoked') {
      return { isRevoked: true };
    }

    const { error: updateError } = await supabase
      .from('accountant_company_access')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq('id', input.grantId);

    if (updateError) {
      logger.error('The grant could not be revoked', updateError, { companyId: company.id });

      throw new AppError('database_failure', 'Access could not be changed. Please try again.');
    }

    await recordAuditEntry({
      action: 'permission_change',
      entityType: 'accountant_company_access',
      entityId: input.grantId,
      companyId: company.id,
      description: 'Access to the books was taken back from an accountant.',
      metadata: { reason: input.reason },
    });

    revalidatePath(`${ROUTES.dashboard}/settings/accountants`);

    return { isRevoked: true };
  },
  { name: 'revokeAccountantAccess' }
);
