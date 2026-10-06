// src/features/storefronts/actions/cancel-order.ts
// Stopping a shop order that has not been paid, with a reason the shop can
// show the shopper.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { cancelOrderSchema } from '@/features/storefronts/validation/storefronts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CancelOrderResult {
  /** True when the order was stopped. */
  wasCancelled: boolean;
}

export const cancelStorefrontOrder = createAction(
  cancelOrderSchema,
  async (input): Promise<CancelOrderResult> => {
    const { company } = await requirePermission('payments', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('cancel_storefront_order', {
      p_order_id: input.orderId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A shop order could not be cancelled', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'storefront_order',
      entityId: input.orderId,
      companyId: company.id,
      description: 'Cancelled a shop order',
      metadata: { reason: input.reason },
    });

    revalidatePath(`${ROUTES.settings}/storefronts`);

    return { wasCancelled: data === true };
  },
  { name: 'cancelStorefrontOrder' }
);
