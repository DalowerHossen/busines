// src/features/admin/actions/set-company-status.ts
// Suspending, reinstating or closing a tenant from the platform console.

'use server';

import { revalidatePath } from 'next/cache';

import { setCompanyStatusSchema } from '@/features/admin/validation/tenant';
import { createAction } from '@/lib/actions/create-action';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetCompanyStatusResult {
  /** The state the tenant is in afterwards. */
  status: string;
}

export const setCompanyStatus = createAction(
  setCompanyStatusSchema,
  async (input): Promise<SetCompanyStatusResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('set_company_status', {
      p_company_id: input.companyId,
      p_status: input.status,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A tenant state could not be changed', error, { companyId: input.companyId });

      throw new AppError(
        'database_failure',
        'That tenant was not changed. It may already be in the state you asked for.'
      );
    }

    revalidatePath('/admin/tenants');
    revalidatePath(`/admin/tenants/${input.companyId}`);

    return { status: typeof data === 'string' ? data : input.status };
  },
  { name: 'setCompanyStatus' }
);
