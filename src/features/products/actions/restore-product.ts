// src/features/products/actions/restore-product.ts
// Brings a deleted catalogue item back into use.

'use server';

import { revalidatePath } from 'next/cache';

import { productIdSchema } from '@/features/products/validation/product';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RestoreProductResult {
  /** Identifier of the item that was brought back. */
  productId: string;
}

export const restoreProduct = createAction(
  productIdSchema,
  async (input): Promise<RestoreProductResult> => {
    const { user, company } = await requirePermission('products', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('products')
      .update({ deleted_at: null, archived_at: null, status: 'active', updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.productId)
      .not('deleted_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not restore a catalogue item', error, { companyId: company.id });

      throw new AppError('database_failure', 'The item could not be restored just now.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That item is not in the deleted list.');
    }

    await recordAuditEntry({
      action: 'restore',
      entityType: 'product',
      entityId: input.productId,
      companyId: company.id,
      description: 'Catalogue item restored.',
    });

    revalidatePath('/dashboard/products');
    revalidatePath(`/dashboard/products/${input.productId}`);

    return { productId: input.productId };
  },
  { name: 'restoreProduct' }
);
