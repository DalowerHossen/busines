// scripts/verify-phase48.ts
// Deterministic coverage checks for the catalogue, stock, supplier and
// purchasing foundations. These checks do not claim live database coverage;
// they guard the tenant and validation boundaries before the phase grows.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  const absolutePath = resolve(root, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} is missing.`);
  return readFileSync(absolutePath, 'utf8');
}

function main(): void {
  const requiredFiles = [
    'src/features/products/types.ts',
    'src/features/products/validation/product.ts',
    'src/features/products/validation/catalogue.ts',
    'src/features/products/queries/list-products.ts',
    'src/features/products/queries/get-product.ts',
    'src/features/products/queries/list-categories.ts',
    'src/features/products/queries/catalogue-references.ts',
    'src/features/products/actions/create-product.ts',
    'src/features/products/actions/manage-catalogue.ts',
    'src/features/products/actions/update-product.ts',
    'src/features/products/actions/delete-product.ts',
    'src/features/inventory/types.ts',
    'src/features/inventory/validation/inventory.ts',
    'src/features/inventory/actions/manage-stock.ts',
    'src/features/inventory/queries/get-stock.ts',
    'src/features/purchasing/queries/get-purchasing.ts',
    'src/app/(app)/dashboard/products/page.tsx',
    'src/app/(app)/dashboard/products/stock/page.tsx',
    'src/app/(app)/dashboard/expenses/suppliers/page.tsx',
    'supabase/migrations/00069_product_bundles.sql',
    'supabase/migrations/00071_warehouses.sql',
    'supabase/migrations/00076_suppliers.sql',
    'supabase/migrations/00077_purchase_orders.sql',
  ];

  for (const relativePath of requiredFiles) read(relativePath);

  const catalogueValidation = read('src/features/products/validation/catalogue.ts');
  assert.match(catalogueValidation, /bundleSchema/u);
  assert.match(catalogueValidation, /priceListSchema/u);
  assert.match(catalogueValidation, /minimumQuantity/u);

  const productValidation = read('src/features/products/validation/product.ts');
  assert.match(productValidation, /productBaseSchema/u);
  assert.match(productValidation, /unitPrice/u);
  assert.match(productValidation, /trackInventory/u);

  const productQuery = read('src/features/products/queries/list-products.ts');
  assert.match(productQuery, /company_id/u);
  assert.match(productQuery, /escapeSearchTerm/u);
  assert.match(productQuery, /safeSortColumn/u);

  const catalogueActions = read('src/features/products/actions/manage-catalogue.ts');
  assert.match(catalogueActions, /assertCompanyProducts/u);
  assert.match(catalogueActions, /company_id/u);
  assert.match(catalogueActions, /product_bundle_items/u);
  assert.match(catalogueActions, /price_list_items/u);

  const stockAction = read('src/features/inventory/actions/manage-stock.ts');
  assert.match(stockAction, /requirePermission/u);
  assert.match(stockAction, /company_id/u);

  const purchasingQuery = read('src/features/purchasing/queries/get-purchasing.ts');
  assert.match(purchasingQuery, /company_id/u);
  assert.match(purchasingQuery, /purchase_orders/u);

  process.stdout.write(
    'Phase 48 verification passed: catalogue validation, tenant-scoped inventory foundations, supplier/purchasing surfaces, and required schema boundaries are present.\n'
  );
}

main();
