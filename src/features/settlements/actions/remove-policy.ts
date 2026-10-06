// src/features/settlements/actions/remove-policy.ts
// Returning one account to the standard collection terms.
//
// Nothing already settled changes. A deal that is dropped only affects the
// payments that come after it, which is the only honest way to do it.

'use server';

import { revalidatePath } from 'next/cache';

import { removeSettlementPolicySchema } from '@/features/settlements/validation/settlement';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RemoveSettlementPolicyResult {
  /** True when the account is back on the standard terms. */
  isRemoved: boolean;
}

export const removeSettlementPolicy = createAction(
  removeSettlementPolicySchema,
  async (input): Promise<RemoveSettlementPolicyResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('delete_settlement_policy', {
      p_company_id: input.companyId,
    });

    if (error) {
      logger.error('Negotiated terms could not be dropped', error, {
        companyId: input.companyId,
      });

      throw new AppError('database_failure', 'Those terms could not be dropped. Try again.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'settlement_policy',
      entityId: input.companyId,
      companyId: input.companyId,
      description: 'Returned this account to the standard collection terms.',
    });

    revalidatePath('/admin/settlements');

    return { isRemoved: data === true };
  },
  { name: 'removeSettlementPolicy' }
);
