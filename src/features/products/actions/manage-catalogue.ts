// src/features/products/actions/manage-catalogue.ts
// Persists bundles and client price lists only after every referenced product
// has been proved to belong to the same company. The database policies are a
// second boundary; these checks keep a cross-company identifier from reaching
// a write in the first place.

'use server';

import { revalidatePath } from 'next/cache';

import { bundleSchema, priceListSchema } from '@/features/products/validation/catalogue';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { asRow, asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validation/primitives';
import { z } from 'zod';

const cataloguePath = '/dashboard/products';

const productIdsSchema = z.object({
  productIds: z.array(uuidSchema).max(500),
});

const bundleIdSchema = z.object({ bundleId: uuidSchema });
const priceListIdSchema = z.object({ priceListId: uuidSchema });

async function assertCompanyProducts(
  companyId: string,
  productIds: readonly string[]
): Promise<void> {
  const uniqueProductIds = [...new Set(productIds)];

  if (uniqueProductIds.length === 0) {
    return;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('company_id', companyId)
    .in('id', uniqueProductIds)
    .is('deleted_at', null);

  if (error) {
    throw new AppError('database_failure', 'The catalogue items could not be checked.');
  }

  const visibleIds = new Set(
    asRows(data)
      .map((row) => readString(row, 'id'))
      .filter((id): id is string => id !== null)
  );

  if (visibleIds.size !== uniqueProductIds.length) {
    throw new AppError(
      'not_found',
      'One or more catalogue items could not be found in this business.'
    );
  }
}

async function insertBundleItems(
  companyId: string,
  bundleId: string,
  items: readonly { productId: string; quantity: string; sortOrder: number }[]
): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('product_bundle_items').insert(
    items.map((item) => ({
      company_id: companyId,
      bundle_id: bundleId,
      product_id: item.productId,
      quantity: item.quantity,
      sort_order: item.sortOrder,
    }))
  );

  if (error) {
    await supabase.from('product_bundles').delete().eq('id', bundleId).eq('company_id', companyId);
    throw new AppError('database_failure', 'The bundle components could not be saved.');
  }
}

export interface CatalogueWriteResult {
  /** Identifier of the newly saved record. */
  id: string;
}

export const createProductBundle = createAction(
  bundleSchema,
  async (input): Promise<CatalogueWriteResult> => {
    const { user, company } = await requirePermission('products', 'create');
    requireWritableCompany(company);
    await assertCompanyProducts(
      company.id,
      input.items.map((item) => item.productId)
    );

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('product_bundles')
      .insert({
        company_id: company.id,
        name: input.name,
        description: input.description,
        currency_code: input.currency,
        bundle_price_amount: input.bundlePrice,
        is_archived: input.isArchived,
      })
      .select('id')
      .single();

    if (error) {
      throw new AppError(
        'conflict',
        'That bundle could not be saved. A bundle with the same name may already exist.'
      );
    }

    const bundle = asRow(data);
    const bundleId = bundle === null ? null : readString(bundle, 'id');

    if (bundleId === null) {
      throw new AppError('database_failure', 'The bundle was saved but returned no identifier.');
    }

    await insertBundleItems(company.id, bundleId, input.items);
    await recordAuditEntry({
      action: 'insert',
      entityType: 'product_bundle',
      entityId: bundleId,
      companyId: company.id,
      description: 'A product bundle was created.',
      metadata: { item_count: input.items.length, created_by: user.id },
    });
    revalidatePath(cataloguePath);

    return { id: bundleId };
  },
  { name: 'createProductBundle' }
);

export const archiveProductBundle = createAction(
  bundleIdSchema,
  async (input): Promise<CatalogueWriteResult> => {
    const { user, company } = await requirePermission('products', 'delete');
    requireWritableCompany(company);
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('product_bundles')
      .update({ deleted_at: new Date().toISOString(), is_archived: true })
      .eq('id', input.bundleId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new AppError('database_failure', 'The bundle could not be archived.');
    }

    const bundle = asRow(data);
    const bundleId = bundle === null ? null : readString(bundle, 'id');

    if (bundleId === null) {
      throw new AppError('not_found', 'That bundle could not be found.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'product_bundle',
      entityId: bundleId,
      companyId: company.id,
      description: 'A product bundle was archived.',
      metadata: { archived_by: user.id },
    });
    revalidatePath(cataloguePath);

    return { id: bundleId };
  },
  { name: 'archiveProductBundle' }
);

export const createPriceList = createAction(
  priceListSchema,
  async (input): Promise<CatalogueWriteResult> => {
    const { user, company } = await requirePermission('products', 'create');
    requireWritableCompany(company);
    await assertCompanyProducts(
      company.id,
      input.items.map((item) => item.productId)
    );

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('price_lists')
      .insert({
        company_id: company.id,
        name: input.name,
        description: input.description,
        method: input.method,
        adjustment_percentage: input.adjustmentPercentage,
        currency: input.currency,
        effective_from: input.effectiveFrom,
        effective_to: input.effectiveTo,
        is_default: input.isDefault,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      throw new AppError(
        'conflict',
        'That price list could not be saved. A list with the same name may already exist.'
      );
    }

    const priceList = asRow(data);
    const priceListId = priceList === null ? null : readString(priceList, 'id');

    if (priceListId === null) {
      throw new AppError(
        'database_failure',
        'The price list was saved but returned no identifier.'
      );
    }

    if (input.items.length > 0) {
      const { error: itemsError } = await supabase.from('price_list_items').insert(
        input.items.map((item) => ({
          company_id: company.id,
          price_list_id: priceListId,
          product_id: item.productId,
          fixed_price: item.fixedPrice ?? null,
          adjustment_percentage: item.adjustmentPercentage ?? null,
          minimum_quantity: item.minimumQuantity,
          created_by: user.id,
          updated_by: user.id,
        }))
      );

      if (itemsError) {
        await supabase
          .from('price_lists')
          .delete()
          .eq('id', priceListId)
          .eq('company_id', company.id);
        throw new AppError('database_failure', 'The price list items could not be saved.');
      }
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'price_list',
      entityId: priceListId,
      companyId: company.id,
      description: 'A client price list was created.',
      metadata: { item_count: input.items.length, created_by: user.id },
    });
    revalidatePath(cataloguePath);

    return { id: priceListId };
  },
  { name: 'createPriceList' }
);

export const archivePriceList = createAction(
  priceListIdSchema,
  async (input): Promise<CatalogueWriteResult> => {
    const { user, company } = await requirePermission('products', 'delete');
    requireWritableCompany(company);
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('price_lists')
      .update({ deleted_at: new Date().toISOString(), archived_at: new Date().toISOString() })
      .eq('id', input.priceListId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new AppError('database_failure', 'The price list could not be archived.');
    }

    const priceList = asRow(data);
    const priceListId = priceList === null ? null : readString(priceList, 'id');

    if (priceListId === null) {
      throw new AppError('not_found', 'That price list could not be found.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'price_list',
      entityId: priceListId,
      companyId: company.id,
      description: 'A client price list was archived.',
      metadata: { archived_by: user.id },
    });
    revalidatePath(cataloguePath);

    return { id: priceListId };
  },
  { name: 'archivePriceList' }
);

export const validateCatalogueProductIds = createAction(
  productIdsSchema,
  async (input): Promise<{ count: number }> => {
    const { company } = await requirePermission('products', 'view');
    await assertCompanyProducts(company.id, input.productIds);
    return { count: new Set(input.productIds).size };
  },
  { name: 'validateCatalogueProductIds' }
);
