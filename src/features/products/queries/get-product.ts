// src/features/products/queries/get-product.ts
// Reading one catalogue item, with the names of the category, unit and tax
// rate it points at.

import { toProductDetail } from '@/features/products/mappers';
import type { ProductDetail } from '@/features/products/types';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DETAIL_COLUMNS =
  'id, name, sku, barcode, description, product_type, status, unit_price, currency, track_inventory, deleted_at, category_id, unit_of_measure_id, tax_rate_id, is_tax_inclusive_price, allow_price_override, minimum_price, cost_price, preferred_supplier_name, is_billable_by_time, default_hours, low_stock_threshold, opening_stock_quantity, hs_code, income_account_code, expense_account_code, internal_notes, is_featured, created_at, product_categories(name), units_of_measure(name), tax_rates(name)';

/**
 * Reads one catalogue item of a company.
 *
 * @param companyId Company the item must belong to.
 * @param productId Item being opened.
 * @returns The item, or null when it does not exist.
 */
export async function getProduct(
  companyId: string,
  productId: string
): Promise<ProductDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .select(DETAIL_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    logger.error('Could not read a catalogue item', error, { companyId, productId });
    return null;
  }

  const row = asRow(data);

  return row === null ? null : toProductDetail(row);
}
