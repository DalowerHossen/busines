// src/features/products/actions/delete-product.ts
// Takes an item out of the catalogue without losing it. Documents that already
// quote the item keep their own copy of the price and description.

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

export interface DeleteProductResult {
  /** Identifier of the item that was removed. */
  productId: string;
}

export const deleteProduct = createAction(
  productIdSchema,
  async (input): Promise<DeleteProductResult> => {
    const { user, company } = await requirePermission('products', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .update({ deleted_at: now, status: 'archived', archived_at: now, updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.productId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not remove a catalogue item', error, { companyId: company.id });

      throw new AppError('database_failure', 'The item could not be removed just now.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That item no longer exists.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'product',
      entityId: input.productId,
      companyId: company.id,
      description: 'Catalogue item deleted.',
    });

    revalidatePath('/dashboard/products');

    return { productId: input.productId };
  },
  { name: 'deleteProduct' }
);
