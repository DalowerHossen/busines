// src/features/products/actions/create-category.ts
// Adds a category so the catalogue can be grouped. The address friendly slug
// is derived from the name, and a name already in use is reported plainly.

'use server';

import { revalidatePath } from 'next/cache';

import { productCategorySchema } from '@/features/products/validation/product';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { slugify } from '@/lib/strings';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CreateCategoryResult {
  /** Identifier of the category that was added. */
  categoryId: string;
}

export const createProductCategory = createAction(
  productCategorySchema,
  async (input): Promise<CreateCategoryResult> => {
    const { user, company } = await requirePermission('products', 'create');
    requireWritableCompany(company);

    const slug = slugify(input.name);

    if (slug.length === 0) {
      throw new AppError('validation_failed', 'Use at least one letter or number in the name.', {
        fieldErrors: { name: ['Use at least one letter or number in the name.'] },
      });
    }

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        company_id: company.id,
        name: input.name,
        slug,
        description: input.description,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Could not add a catalogue category', error, { companyId: company.id });

      throw new AppError(
        'conflict',
        'That category could not be added. A category with the same name may already exist.'
      );
    }

    const categoryId = readString(asRow(data) ?? {}, 'id');

    if (categoryId === null) {
      throw new AppError('database_failure', 'The category was saved but could not be read back.');
    }

    revalidatePath('/dashboard/products');

    return { categoryId };
  },
  { name: 'createProductCategory' }
);
