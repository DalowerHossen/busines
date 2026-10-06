// src/features/billing/actions/redeem-coupon.ts
// Claiming a discount code against the current plan. The database checks the
// code, so an expired or already used code never reaches the price.

'use server';

import { revalidatePath } from 'next/cache';

import { redeemCouponSchema } from '@/features/billing/validation/billing';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RedeemCouponResult {
  /** The amount taken off the next charge. */
  discountAmount: string;
}

export const redeemCoupon = createAction(
  redeemCouponSchema,
  async (input): Promise<RedeemCouponResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('id, amount')
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .not('status', 'in', '(cancelled,expired)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const subscription = asRow(subscriptionData);

    if (subscription === null) {
      throw new AppError('not_found', 'There is no plan for this code to apply to.');
    }

    const subscriptionId = readString(subscription, 'id');
    const amount = readAmount(subscription, 'amount');

    const { error } = await supabase.rpc('redeem_coupon', {
      p_code: input.code,
      p_company_id: company.id,
      p_subscription_id: subscriptionId,
      p_amount: Number.parseFloat(amount),
    });

    if (error) {
      logger.error('A discount code could not be claimed', error, { companyId: company.id });

      throw new AppError(
        'validation_failed',
        'This code could not be used. Check it is still valid and has not been claimed already.'
      );
    }

    const { data: updatedData } = await supabase
      .from('subscriptions')
      .select('discount_amount')
      .eq('id', subscriptionId ?? '')
      .maybeSingle();

    const updated = asRow(updatedData);

    await recordAuditEntry({
      action: 'update',
      entityType: 'subscription',
      entityId: subscriptionId,
      companyId: company.id,
      description: `Discount code ${input.code} claimed.`,
    });

    revalidatePath('/dashboard/billing');

    return { discountAmount: updated === null ? '0' : readAmount(updated, 'discount_amount') };
  },
  { name: 'redeemCoupon' }
);
