// src/features/admin/actions/save-plan-price.ts
// Setting what one plan costs for one interval in one currency.

'use server';

import { revalidatePath } from 'next/cache';

import { savePlanPriceSchema } from '@/features/admin/validation/catalogue';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { toMinorUnits } from '@/lib/money';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SavePlanPriceResult {
  /** Identifier of the price that was written. */
  priceId: string;
}

export const savePlanPrice = createAction(
  savePlanPriceSchema,
  async (input): Promise<SavePlanPriceResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const payload = {
      plan_id: input.planId,
      billing_interval: input.interval,
      currency: input.currency,
      amount: input.amount,
      amount_minor: toMinorUnits(input.amount, input.currency),
      compare_at_amount: input.compareAtAmount ?? null,
      is_active: input.isActive,
    };

    if (input.priceId) {
      const { error } = await supabase.from('plan_prices').update(payload).eq('id', input.priceId);

      if (error) {
        logger.error('A plan price could not be saved', error, { priceId: input.priceId });

        throw new AppError('database_failure', 'That price was not saved. Please try again.');
      }

      await recordAuditEntry({
        action: 'update',
        entityType: 'plan_price',
        entityId: input.priceId,
        companyId: null,
        description: `Price revised to ${input.amount} ${input.currency}.`,
      });

      revalidatePath('/admin/plans');

      return { priceId: input.priceId };
    }

    const { data, error } = await supabase
      .from('plan_prices')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('A plan price could not be created', error, { planId: input.planId });

      throw new AppError(
        'database_failure',
        'That price was not created. This plan may already be sold at that interval and currency.'
      );
    }

    const created = asRow(data);
    const priceId = created === null ? '' : (readString(created, 'id') ?? '');

    await recordAuditEntry({
      action: 'insert',
      entityType: 'plan_price',
      entityId: priceId,
      companyId: null,
      description: `Price of ${input.amount} ${input.currency} added.`,
    });

    revalidatePath('/admin/plans');

    return { priceId };
  },
  { name: 'savePlanPrice' }
);
