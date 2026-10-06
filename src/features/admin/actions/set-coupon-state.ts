// src/features/admin/actions/set-coupon-state.ts
// Switching a discount code on or off without deleting it, so the codes
// already claimed keep working exactly as they were.

'use server';

import { revalidatePath } from 'next/cache';

import { setCouponStateSchema } from '@/features/admin/validation/catalogue';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetCouponStateResult {
  /** Identifier of the code that was switched. */
  couponId: string;
}

export const setCouponState = createAction(
  setCouponStateSchema,
  async (input): Promise<SetCouponStateResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('coupons')
      .update({ is_active: input.isActive })
      .eq('id', input.couponId);

    if (error) {
      logger.error('A discount code could not be switched', error, { couponId: input.couponId });

      throw new AppError('database_failure', 'That code was not changed. Please try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'coupon',
      entityId: input.couponId,
      companyId: null,
      description: input.isActive ? 'Discount code switched on.' : 'Discount code switched off.',
    });

    revalidatePath('/admin/plans');

    return { couponId: input.couponId };
  },
  { name: 'setCouponState' }
);
