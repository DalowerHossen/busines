// src/features/admin/actions/save-coupon.ts
// Creating or revising a discount code the platform hands out.

'use server';

import { revalidatePath } from 'next/cache';

import { saveCouponSchema } from '@/features/admin/validation/catalogue';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveCouponResult {
  /** Identifier of the code that was written. */
  couponId: string;
}

export const saveCoupon = createAction(
  saveCouponSchema,
  async (input): Promise<SaveCouponResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const payload = {
      code: input.code,
      name: input.name,
      coupon_type: input.couponType,
      value: input.value,
      currency: input.currency ?? null,
      duration_months: input.durationMonths ?? null,
      max_redemptions: input.maxRedemptions ?? null,
      max_redemptions_per_account: input.maxRedemptionsPerAccount,
      valid_until: input.validUntil,
      campaign_name: input.campaignName,
      is_active: input.isActive,
    };

    if (input.couponId) {
      const { error } = await supabase.from('coupons').update(payload).eq('id', input.couponId);

      if (error) {
        logger.error('A discount code could not be saved', error, { couponId: input.couponId });

        throw new AppError('database_failure', 'That code was not saved. Please try again.');
      }

      await recordAuditEntry({
        action: 'update',
        entityType: 'coupon',
        entityId: input.couponId,
        companyId: null,
        description: `Discount code ${input.code} revised.`,
      });

      revalidatePath('/admin/plans');

      return { couponId: input.couponId };
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('A discount code could not be created', error, { code: input.code });

      throw new AppError(
        'database_failure',
        'That code was not created. It may already be in use.'
      );
    }

    const created = asRow(data);
    const couponId = created === null ? '' : (readString(created, 'id') ?? '');

    await recordAuditEntry({
      action: 'insert',
      entityType: 'coupon',
      entityId: couponId,
      companyId: null,
      description: `Discount code ${input.code} created.`,
    });

    revalidatePath('/admin/plans');

    return { couponId };
  },
  { name: 'saveCoupon' }
);
