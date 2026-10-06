// src/features/products/actions/update-product.ts
// Saves changes to a catalogue item. Documents already issued keep the price
// they carried at the time; a change here applies to new documents only.

'use server';

import { revalidatePath } from 'next/cache';

import { updateProductSchema } from '@/features/products/validation/product';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateProductResult {
  /** Identifier of the item that was saved. */
  productId: string;
}

export const updateProduct = createAction(
  updateProductSchema,
  async (input): Promise<UpdateProductResult> => {
    const { user, company } = await requirePermission('products', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('products')
      .update({
        name: input.name,
        sku: input.sku,
        barcode: input.barcode,
        description: input.description,
        product_type: input.productType,
        status: input.status,
        category_id: input.categoryId,
        unit_of_measure_id: input.unitOfMeasureId,
        unit_price: input.unitPrice,
        currency: input.currency ?? company.baseCurrency,
        tax_rate_id: input.taxRateId,
        is_tax_inclusive_price: input.isTaxInclusivePrice,
        allow_price_override: input.allowPriceOverride,
        minimum_price: input.minimumPrice,
        cost_price: input.costPrice,
        preferred_supplier_name: input.preferredSupplierName,
        is_billable_by_time: input.isBillableByTime,
        default_hours: input.defaultHours,
        track_inventory: input.trackInventory,
        low_stock_threshold: input.lowStockThreshold,
        hs_code: input.hsCode,
        income_account_code: input.incomeAccountCode,
        expense_account_code: input.expenseAccountCode,
        internal_notes: input.internalNotes,
        is_featured: input.isFeatured,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.productId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not save a catalogue item', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The item could not be saved. Please try again in a moment.'
      );
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That item no longer exists.');
    }

    revalidatePath('/dashboard/products');
    revalidatePath(`/dashboard/products/${input.productId}`);

    return { productId: input.productId };
  },
  { name: 'updateProduct' }
);
