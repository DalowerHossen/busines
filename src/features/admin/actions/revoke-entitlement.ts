// src/features/admin/actions/revoke-entitlement.ts
// Withdrawing an exception so a tenant falls back to the plan it pays for.

'use server';

import { revalidatePath } from 'next/cache';

import { revokeEntitlementSchema } from '@/features/admin/validation/tenant';
import { createAction } from '@/lib/actions/create-action';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RevokeEntitlementResult {
  /** Identifier of the exception that was withdrawn. */
  overrideId: string;
}

export const revokeEntitlement = createAction(
  revokeEntitlementSchema,
  async (input): Promise<RevokeEntitlementResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('revoke_entitlement_override', {
      p_override_id: input.overrideId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('An exception could not be withdrawn', error, { companyId: input.companyId });

      throw new AppError('database_failure', 'That exception was not withdrawn. Please try again.');
    }

    revalidatePath(`/admin/tenants/${input.companyId}`);

    return { overrideId: input.overrideId };
  },
  { name: 'revokeEntitlement' }
);
