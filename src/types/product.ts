// src/types/product.ts
// Product/service catalog domain types, referenced by InvoiceLineItem
// (src/types/invoice.ts) and by the inventory/warehouse domain added in a
// later phase.
import type { Money, TenantScopedEntity, UUID } from '@/types/core';

/**
 * Whether a catalog entry is a physical good (tracked in inventory) or a
 * service (never tracked in inventory).
 */
export type ProductType = 'product' | 'service';

/**
 * A named grouping of products/services (for example "Consulting" or
 * "Hardware").
 */
export interface ProductCategory extends TenantScopedEntity {
  readonly name: string;
  readonly parentCategoryId: UUID | null;
}

/**
 * A sellable product or service in a company's catalog.
 */
export interface Product extends TenantScopedEntity {
  readonly type: ProductType;
  readonly name: string;
  readonly sku: string | null;
  readonly description: string | null;
  readonly unitPrice: Money;
  readonly defaultTaxRatePercent: string | null;
  readonly categoryId: UUID | null;
  readonly trackInventory: boolean;
  readonly isArchived: boolean;
}

/**
 * A fixed bundle of products/services sold together under one price.
 */
export interface ProductBundle extends TenantScopedEntity {
  readonly name: string;
  readonly bundlePrice: Money;
  readonly productIds: readonly UUID[];
}
