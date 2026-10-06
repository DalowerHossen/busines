// src/app/(app)/dashboard/products/[productId]/page.tsx
// One catalogue item: its price, tax treatment, cost and stock settings.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ProductDetailCards } from '@/components/products/product-detail-cards';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getProduct } from '@/features/products/queries/get-product';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Catalogue item',
  description: 'The price, tax treatment and stock settings of one item.',
  path: ROUTES.products,
  noIndex: true,
});

export interface ProductPageProps {
  /** The item identifier taken from the address. */
  params: { productId: string };
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

/**
 * Renders the page of one catalogue item.
 *
 * @param props The item identifier from the address.
 * @returns The rendered page.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'products', 'view')) {
    return (
      <>
        <PageHeader title="Catalogue item" description="You do not have access to the catalogue." />
        <Alert tone="warning" title="You cannot see the catalogue">
          Ask the owner of this business to give your account permission to view products.
        </Alert>
      </>
    );
  }

  const product = await getProduct(company.id, params.productId);

  if (product === null) {
    notFound();
  }

  const canEdit = can(user, 'products', 'edit');

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={product.sku === null ? 'No item code set' : `Item code ${product.sku}`}
        breadcrumbs={[
          { label: 'Products and services', href: ROUTES.products },
          { label: product.name },
        ]}
        badge={
          <Badge
            tone={
              product.isDeleted ? 'danger' : product.status === 'active' ? 'success' : 'neutral'
            }
          >
            {product.isDeleted ? 'Deleted' : (STATUS_LABELS[product.status] ?? 'Active')}
          </Badge>
        }
        actions={
          canEdit ? (
            <Link
              href={`${ROUTES.products}/${product.id}/edit`}
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              Edit item
            </Link>
          ) : null
        }
      />

      {product.isDeleted ? (
        <Alert tone="warning" title="This item has been deleted">
          It no longer appears when you build an invoice. Restore it from the deleted view when you
          need it again.
        </Alert>
      ) : null}

      <ProductDetailCards product={product} fallbackCurrency={company.baseCurrency} />
    </div>
  );
}
