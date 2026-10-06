// src/features/admin/actions/grant-entitlement.ts
// Giving one tenant an exception to its plan, with the reason kept on the
// record so the next person understands why.

'use server';

import { revalidatePath } from 'next/cache';

import { grantEntitlementSchema } from '@/features/admin/validation/tenant';
import { createAction } from '@/lib/actions/create-action';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface GrantEntitlementResult {
  /** Identifier of the exception that was written. */
  overrideId: string;
}

/**
 * Turns the typed value into the shape the entitlement document expects.
 *
 * @param raw Text entered in the console.
 * @returns A number, a boolean or null for unlimited.
 */
function toEntitlementValue(raw: string): Json {
  const lowered = raw.toLowerCase();

  if (lowered === 'true' || lowered === 'false') {
    return lowered === 'true';
  }

  if (lowered === 'unlimited' || lowered === 'null') {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed)) {
    throw new AppError('validation_failed', 'Enter a whole number, true, false, or unlimited.', {
      fieldErrors: { value: ['Enter a whole number, true, false, or unlimited.'] },
    });
  }

  return parsed;
}

export const grantEntitlement = createAction(
  grantEntitlementSchema,
  async (input): Promise<GrantEntitlementResult> => {
    await requireSuperAdmin();

    const value = toEntitlementValue(input.value);
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('grant_entitlement_override', {
      p_company_id: input.companyId,
      p_entitlement_key: input.entitlementKey,
      p_value: value,
      p_reason: input.reason,
      p_expires_at: input.expiresAt,
    });

    if (error) {
      logger.error('An exception could not be granted', error, { companyId: input.companyId });

      throw new AppError('database_failure', 'That exception was not saved. Please try again.');
    }

    revalidatePath(`/admin/tenants/${input.companyId}`);

    return { overrideId: typeof data === 'string' ? data : '' };
  },
  { name: 'grantEntitlement' }
);
