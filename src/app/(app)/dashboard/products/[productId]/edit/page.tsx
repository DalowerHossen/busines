// src/app/(app)/dashboard/products/[productId]/edit/page.tsx
// Editing a catalogue item with the same form used to add one.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ProductForm } from '@/components/products/product-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCatalogueReferences } from '@/features/products/queries/catalogue-references';
import { getProduct } from '@/features/products/queries/get-product';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Edit item',
  description: 'Change the price, tax rate and stock settings of a catalogue item.',
  path: ROUTES.products,
  noIndex: true,
});

export interface EditProductPageProps {
  /** The item identifier taken from the address. */
  params: { productId: string };
}

/**
 * Renders the edit item page.
 *
 * @param props The item identifier from the address.
 * @returns The rendered page.
 */
export default async function EditProductPage({ params }: EditProductPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'products', 'edit')) {
    return (
      <>
        <PageHeader title="Edit item" description="You cannot change this catalogue." />
        <Alert tone="warning" title="You cannot edit this item">
          Ask the owner of this business to give your account permission to edit products.
        </Alert>
      </>
    );
  }

  const [product, references] = await Promise.all([
    getProduct(company.id, params.productId),
    loadCatalogueReferences(company.id),
  ]);

  if (product === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${product.name}`}
        description="Changes apply to documents you raise from now on. Invoices already issued keep the price they carried."
        breadcrumbs={[
          { label: 'Products and services', href: ROUTES.products },
          { label: product.name, href: `${ROUTES.products}/${product.id}` },
          { label: 'Edit' },
        ]}
      />

      <ProductForm
        product={product}
        references={references}
        defaultCurrency={company.baseCurrency}
      />
    </div>
  );
}
