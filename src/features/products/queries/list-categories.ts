// src/features/products/queries/list-categories.ts
// The categories of one company, each with the number of items inside it, for
// the panel beside the catalogue list.

import { toProductCategory } from '@/features/products/mappers';
import type { ProductCategoryRecord } from '@/features/products/types';
import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Lists the catalogue categories of one company.
 *
 * @param companyId Company whose categories are read.
 * @returns The categories, with how many items sit in each one.
 */
export async function listProductCategories(
  companyId: string
): Promise<readonly ProductCategoryRecord[]> {
  const supabase = createServerSupabaseClient();

  const [categories, products] = await Promise.all([
    supabase
      .from('product_categories')
      .select('id, name, slug, description')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('products')
      .select('category_id')
      .eq('company_id', companyId)
      .is('deleted_at', null),
  ]);

  if (categories.error) {
    logger.error('Could not list catalogue categories', categories.error, { companyId });
    return [];
  }

  const counts = new Map<string, number>();

  for (const row of asRows(products.data)) {
    const categoryId = readString(row, 'category_id');

    if (categoryId !== null) {
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    }
  }

  return asRows(categories.data).map((row) => {
    const id = readString(row, 'id') ?? '';
    return toProductCategory(row, counts.get(id) ?? 0);
  });
}
