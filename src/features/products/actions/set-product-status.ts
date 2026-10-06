// src/features/products/actions/set-product-status.ts
// Moves a catalogue item between active, inactive and archived. An archived
// item stops being offered on new documents but stays on the old ones.

'use server';

import { revalidatePath } from 'next/cache';

import { setProductStatusSchema } from '@/features/products/validation/product';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ProductStatus } from '@/types/enums';

export interface SetProductStatusResult {
  /** Status the item now holds. */
  status: ProductStatus;
}

export const setProductStatus = createAction(
  setProductStatusSchema,
  async (input): Promise<SetProductStatusResult> => {
    const { user, company } = await requirePermission('products', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('products')
      .update({
        status: input.status,
        archived_at: input.status === 'archived' ? new Date().toISOString() : null,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.productId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not change the item status', error, { companyId: company.id });

      throw new AppError('database_failure', 'The item status could not be changed.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That item no longer exists.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'product',
      entityId: input.productId,
      companyId: company.id,
      description: `Catalogue item status changed to ${input.status}.`,
    });

    revalidatePath('/dashboard/products');
    revalidatePath(`/dashboard/products/${input.productId}`);

    return { status: input.status };
  },
  { name: 'setProductStatus' }
);
