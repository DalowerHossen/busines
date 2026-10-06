// src/features/products/types.ts
// The shapes the catalogue works with: the items that are sold, the categories
// they sit in, and the reference lists the forms offer.

import type { ProductStatus, ProductType } from '@/types/enums';

export interface ProductSummary {
  id: string;
  name: string;
  sku: string | null;
  productType: ProductType;
  status: ProductStatus;
  unitPrice: string;
  currency: string | null;
  categoryName: string | null;
  trackInventory: boolean;
  isDeleted: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  categoryId: string | null;
  unitOfMeasureId: string | null;
  unitName: string | null;
  barcode: string | null;
  taxRateId: string | null;
  taxRateName: string | null;
  isTaxInclusivePrice: boolean;
  allowPriceOverride: boolean;
  minimumPrice: string | null;
  costPrice: string | null;
  preferredSupplierName: string | null;
  isBillableByTime: boolean;
  defaultHours: string | null;
  lowStockThreshold: string | null;
  openingStockQuantity: string;
  hsCode: string | null;
  incomeAccountCode: string | null;
  expenseAccountCode: string | null;
  internalNotes: string | null;
  isFeatured: boolean;
  createdAt: string | null;
}

export interface ProductCategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
}

export interface CatalogueReference {
  id: string;
  label: string;
}

export interface CatalogueReferences {
  categories: readonly CatalogueReference[];
  units: readonly CatalogueReference[];
  taxRates: readonly CatalogueReference[];
}

export interface ProductListFilters {
  /** Free text matched against the name, the code and the description. */
  search: string | null;
  /** Status to narrow by, or null for every status. */
  status: ProductStatus | null;
  /** Kind of item to narrow by, or null for every kind. */
  productType: ProductType | null;
  /** Category to narrow by, or null for every category. */
  categoryId: string | null;
  /** True to list items that have been deleted. */
  includeDeleted: boolean;
}
