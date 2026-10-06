// src/features/products/actions/create-product.ts
// Adds an item to the catalogue of the signed in company.

'use server';

import { revalidatePath } from 'next/cache';

import { createProductSchema } from '@/features/products/validation/product';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CreateProductResult {
  /** Identifier of the item that was added. */
  productId: string;
}

export const createProduct = createAction(
  createProductSchema,
  async (input): Promise<CreateProductResult> => {
    const { user, company } = await requirePermission('products', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('products')
      .insert({
        company_id: company.id,
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
        opening_stock_quantity: input.openingStockQuantity ?? '0',
        hs_code: input.hsCode,
        income_account_code: input.incomeAccountCode,
        expense_account_code: input.expenseAccountCode,
        internal_notes: input.internalNotes,
        is_featured: input.isFeatured,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Could not add a catalogue item', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The item could not be saved. Please try again in a moment.'
      );
    }

    const productId = readString(asRow(data) ?? {}, 'id');

    if (productId === null) {
      throw new AppError('database_failure', 'The item was saved but could not be read back.');
    }

    revalidatePath('/dashboard/products');

    return { productId };
  },
  { name: 'createProduct' }
);
