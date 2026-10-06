// src/features/resellers/actions/set-account-status.ts
// Suspending or restoring an account a partner manages. The data inside the
// account is never touched, only the ability to use it.

'use server';

import { revalidatePath } from 'next/cache';

import { setAccountStatusSchema } from '@/features/resellers/validation/reseller';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireUser } from '@/lib/auth/guards';
import { ROUTES } from '@/config/app';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetAccountStatusResult {
  /** True once the account has been changed. */
  isChanged: boolean;
}

export const setResellerAccountStatus = createAction(
  setAccountStatusSchema,
  async (input): Promise<SetAccountStatusResult> => {
    await requireUser();

    if (input.status !== 'active' && (input.reason === null || input.reason.length < 3)) {
      throw new AppError('validation_failed', 'Say why this account is being stopped.');
    }

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('set_sub_tenant_status', {
      p_company_id: input.companyId,
      p_status: input.status,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A partner account could not be changed', error, {
        companyId: input.companyId,
      });

      throw new AppError('database_failure', 'That account was not changed. Please try again.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'company',
      entityId: input.companyId,
      description: `White label partner set the account to ${input.status}.`,
    });

    revalidatePath(`${ROUTES.reseller}/accounts`);

    return { isChanged: true };
  },
  { name: 'setResellerAccountStatus' }
);
