// src/app/(app)/dashboard/products/new/page.tsx
// Adding an item to the catalogue, with the company currency and the existing
// categories, units and tax rates already loaded.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCatalogueReferences } from '@/features/products/queries/catalogue-references';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Add an item',
  description: 'Save a product or a service so an invoice line takes seconds.',
  path: `${ROUTES.products}/new`,
  noIndex: true,
});

/**
 * Renders the add item page.
 *
 * @returns The rendered page.
 */
export default async function NewProductPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'products', 'create')) {
    return (
      <>
        <PageHeader title="Add an item" description="You cannot add items to this catalogue." />
        <Alert tone="warning" title="You cannot add an item">
          Ask the owner of this business to give your account permission to create products.
        </Alert>
      </>
    );
  }

  const references = await loadCatalogueReferences(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add an item"
        description="Enter the price and tax once. Every invoice line that uses this item is filled in from here."
        breadcrumbs={[
          { label: 'Products and services', href: ROUTES.products },
          { label: 'Add an item' },
        ]}
      />

      <ProductForm references={references} defaultCurrency={company.baseCurrency} />
    </div>
  );
}
