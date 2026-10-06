// src/features/products/mappers.ts
// Turning catalogue rows into the shapes the interface renders.

import type {
  ProductCategoryRecord,
  ProductDetail,
  ProductSummary,
} from '@/features/products/types';
import { readAmount, readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import { PRODUCT_STATUSES, PRODUCT_TYPES } from '@/types/enums';

/**
 * Reads the name held on a joined row, such as a category or a unit.
 *
 * @param row Row returned by the database.
 * @param column Column holding the joined object.
 * @param field Field of that object to read.
 * @returns The name, or null when the join found nothing.
 */
function readJoinedText(row: DatabaseRow, column: string, field: string): string | null {
  const value = row[column];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const inner = (value as Record<string, unknown>)[field];
  return typeof inner === 'string' && inner.length > 0 ? inner : null;
}

/**
 * Maps one row of the catalogue list.
 *
 * @param row Row read from public.products.
 * @returns The item as the list renders it.
 */
export function toProductSummary(row: DatabaseRow): ProductSummary {
  return {
    id: readString(row, 'id') ?? '',
    name: readString(row, 'name') ?? '',
    sku: readString(row, 'sku'),
    productType: readEnum(row, 'product_type', PRODUCT_TYPES, 'service'),
    status: readEnum(row, 'status', PRODUCT_STATUSES, 'active'),
    unitPrice: readAmount(row, 'unit_price'),
    currency: readString(row, 'currency'),
    categoryName: readJoinedText(row, 'product_categories', 'name'),
    trackInventory: readBoolean(row, 'track_inventory'),
    isDeleted: readString(row, 'deleted_at') !== null,
  };
}

/**
 * Maps the full catalogue item shown on its own page.
 *
 * @param row Row read from public.products.
 * @returns The item detail record.
 */
export function toProductDetail(row: DatabaseRow): ProductDetail {
  return {
    ...toProductSummary(row),
    description: readString(row, 'description'),
    categoryId: readString(row, 'category_id'),
    unitOfMeasureId: readString(row, 'unit_of_measure_id'),
    unitName: readJoinedText(row, 'units_of_measure', 'name'),
    barcode: readString(row, 'barcode'),
    taxRateId: readString(row, 'tax_rate_id'),
    taxRateName: readJoinedText(row, 'tax_rates', 'name'),
    isTaxInclusivePrice: readBoolean(row, 'is_tax_inclusive_price'),
    allowPriceOverride: readBoolean(row, 'allow_price_override', true),
    minimumPrice: row['minimum_price'] === null ? null : readAmount(row, 'minimum_price'),
    costPrice: row['cost_price'] === null ? null : readAmount(row, 'cost_price'),
    preferredSupplierName: readString(row, 'preferred_supplier_name'),
    isBillableByTime: readBoolean(row, 'is_billable_by_time'),
    defaultHours: row['default_hours'] === null ? null : readAmount(row, 'default_hours'),
    lowStockThreshold:
      row['low_stock_threshold'] === null ? null : readAmount(row, 'low_stock_threshold'),
    openingStockQuantity: readAmount(row, 'opening_stock_quantity'),
    hsCode: readString(row, 'hs_code'),
    incomeAccountCode: readString(row, 'income_account_code'),
    expenseAccountCode: readString(row, 'expense_account_code'),
    internalNotes: readString(row, 'internal_notes'),
    isFeatured: readBoolean(row, 'is_featured'),
    createdAt: readString(row, 'created_at'),
  };
}

/**
 * Maps one category of the catalogue.
 *
 * @param row Row read from public.product_categories.
 * @param productCount How many items sit in the category.
 * @returns The category record.
 */
export function toProductCategory(row: DatabaseRow, productCount: number): ProductCategoryRecord {
  return {
    id: readString(row, 'id') ?? '',
    name: readString(row, 'name') ?? '',
    slug: readString(row, 'slug') ?? '',
    description: readString(row, 'description'),
    productCount: readNumber(row, 'product_count') ?? productCount,
  };
}
