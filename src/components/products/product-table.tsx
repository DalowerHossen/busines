// src/components/products/product-table.tsx
// The catalogue list. A table on a wide screen and the same rows as cards on a
// telephone, so nothing has to be scrolled sideways.

'use client';

import { PackagePlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ProductRowActions } from '@/components/products/product-row-actions';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/config/app';
import type { ProductSummary } from '@/features/products/types';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ProductTableProps {
  /** Items on the current page. */
  products: readonly ProductSummary[];
  /** Items matching the filter in total. */
  totalCount: number;
  /** Page currently shown. */
  page: number;
  /** Rows shown on one page. */
  pageSize: number;
  /** Currency used when an item has none of its own. */
  fallbackCurrency: string;
  /** True when a search or filter is applied. */
  isFiltered: boolean;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  goods: 'Goods',
  service: 'Service',
  digital: 'Digital download',
  subscription: 'Subscription',
  billable_expense: 'Billable expense',
};

const STATUS_TONES: Record<string, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  inactive: 'neutral',
  archived: 'warning',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

/**
 * Renders the catalogue with paging.
 *
 * @param props The page of items and what the account may do.
 * @returns The rendered list.
 */
export function ProductTable({
  products,
  totalCount,
  page,
  pageSize,
  fallbackCurrency,
  isFiltered,
  canEdit,
  canDelete,
}: ProductTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Moves to another page of the list.
   *
   * @param nextPage Page to open.
   * @returns Nothing.
   */
  function goToPage(nextPage: number): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPage));
    router.push(`${pathname}?${next.toString()}`);
  }

  /**
   * Changes how many rows are shown on one page.
   *
   * @param nextSize Rows to show.
   * @returns Nothing.
   */
  function changePageSize(nextSize: number): void {
    const next = new URLSearchParams(searchParams.toString());
    next.set('pageSize', String(nextSize));
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  }

  if (products.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon={PackagePlus}
        title="Nothing matches this view"
        description="Try a different search term, or clear the filters to see the whole catalogue again."
      />
    ) : (
      <EmptyState
        icon={PackagePlus}
        title="Build your catalogue"
        description="Save the things you sell once, with their price and tax rate, and every invoice line becomes two clicks."
        action={
          <Link
            href={`${ROUTES.products}/new`}
            className={cn(buttonVariants({ variant: 'primary' }))}
          >
            Add item
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden sm:block">
        <Table caption="Products and services offered by this company">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Item</TableHead>
              <TableHead scope="col">Code</TableHead>
              <TableHead scope="col">Type</TableHead>
              <TableHead scope="col">Category</TableHead>
              <TableHead scope="col" isNumeric>
                Price
              </TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">
                <span className="visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Link
                    href={`${ROUTES.products}/${product.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {product.name}
                  </Link>
                  {product.trackInventory ? (
                    <p className="text-xs text-muted-foreground">Stock tracked</p>
                  ) : null}
                </TableCell>
                <TableCell className="tabular">{product.sku ?? '—'}</TableCell>
                <TableCell>{TYPE_LABELS[product.productType] ?? product.productType}</TableCell>
                <TableCell>{product.categoryName ?? 'Uncategorised'}</TableCell>
                <TableCell isNumeric>
                  {formatMoney(product.unitPrice, product.currency ?? fallbackCurrency)}
                </TableCell>
                <TableCell>
                  <Badge tone={product.isDeleted ? 'danger' : STATUS_TONES[product.status]}>
                    {product.isDeleted ? 'Deleted' : STATUS_LABELS[product.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ProductRowActions product={product} canEdit={canEdit} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {products.map((product) => (
          <li key={product.id} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`${ROUTES.products}/${product.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {product.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABELS[product.productType] ?? product.productType}
                </p>
              </div>
              <ProductRowActions product={product} canEdit={canEdit} canDelete={canDelete} />
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="tabular">
                  {formatMoney(product.unitPrice, product.currency ?? fallbackCurrency)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Category</dt>
                <dd>{product.categoryName ?? 'Uncategorised'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge tone={product.isDeleted ? 'danger' : STATUS_TONES[product.status]}>
                    {product.isDeleted ? 'Deleted' : STATUS_LABELS[product.status]}
                  </Badge>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
      />
    </div>
  );
}
