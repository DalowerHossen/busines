// src/app/(app)/dashboard/products/page.tsx
// The catalogue: everything this company sells, with its price, tax rate and
// category, ready to drop onto an invoice.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CategoryPanel } from '@/components/products/category-panel';
import { ProductFilters } from '@/components/products/product-filters';
import { ProductSummaryStrip } from '@/components/products/product-summary-strip';
import { ProductTable } from '@/components/products/product-table';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { listProductCategories } from '@/features/products/queries/list-categories';
import { countProducts, listProducts } from '@/features/products/queries/list-products';
import { productListFiltersSchema } from '@/features/products/validation/product';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';
import { parseListQuery } from '@/lib/validation/pagination';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Products and services',
  description: 'The catalogue this company sells from.',
  path: ROUTES.products,
  noIndex: true,
});

export interface ProductsPageProps {
  /** Filters and paging read from the address bar. */
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Reads one search parameter as text.
 *
 * @param value Raw value from the address bar.
 * @returns The text, or undefined when it is not a single value.
 */
function readParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Renders the catalogue.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Products and services"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'products', 'view')) {
    return (
      <>
        <PageHeader
          title="Products and services"
          description="You do not have access to the catalogue."
        />
        <Alert tone="warning" title="You cannot see the catalogue">
          Ask the owner of this business to give your account permission to view products.
        </Alert>
      </>
    );
  }

  const query = parseListQuery({
    page: readParam(searchParams['page']),
    pageSize: readParam(searchParams['pageSize']),
    search: readParam(searchParams['search']),
    sortBy: readParam(searchParams['sortBy']),
    sortDirection: readParam(searchParams['sortDirection']) ?? 'asc',
  });

  const parsedFilters = productListFiltersSchema.safeParse({
    search: readParam(searchParams['search']),
    status: readParam(searchParams['status']),
    productType: readParam(searchParams['type']),
    categoryId: readParam(searchParams['category']),
    includeDeleted: readParam(searchParams['deleted']),
  });

  const filters = parsedFilters.success
    ? {
        search: parsedFilters.data.search,
        status: parsedFilters.data.status,
        productType: parsedFilters.data.productType,
        categoryId: parsedFilters.data.categoryId,
        includeDeleted: parsedFilters.data.includeDeleted,
      }
    : {
        search: null,
        status: null,
        productType: null,
        categoryId: null,
        includeDeleted: false,
      };

  const [page, counts, categories] = await Promise.all([
    listProducts(company.id, query, filters),
    countProducts(company.id),
    listProductCategories(company.id),
  ]);

  const canCreate = can(user, 'products', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products and services"
        description="Save what you sell once, with its price and tax rate, and invoicing becomes a matter of seconds."
        actions={
          canCreate ? (
            <Link
              href={`${ROUTES.products}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              Add item
            </Link>
          ) : null
        }
      />

      {page.isDegraded ? (
        <Alert tone="warning" title="The catalogue could not be read">
          Nothing has been lost. Refresh the page in a moment and the list will come back.
        </Alert>
      ) : null}

      <ProductSummaryStrip counts={counts} />

      <ProductFilters
        search={filters.search}
        status={filters.status}
        productType={filters.productType}
        categoryId={filters.categoryId}
        categories={categories.map((category) => ({ id: category.id, label: category.name }))}
        includeDeleted={filters.includeDeleted}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <ProductTable
          products={page.items}
          totalCount={page.totalCount}
          page={page.page}
          pageSize={page.pageSize}
          fallbackCurrency={company.baseCurrency}
          isFiltered={
            filters.search !== null ||
            filters.status !== null ||
            filters.productType !== null ||
            filters.categoryId !== null ||
            filters.includeDeleted
          }
          canEdit={can(user, 'products', 'edit')}
          canDelete={can(user, 'products', 'delete')}
        />

        <CategoryPanel
          categories={categories}
          activeCategoryId={filters.categoryId}
          canCreate={canCreate}
        />
      </div>
    </div>
  );
}
