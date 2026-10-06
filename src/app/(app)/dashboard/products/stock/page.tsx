// src/app/(app)/dashboard/products/stock/page.tsx
// What is on the shelf, what it is worth and what is running out.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { StockConsole } from '@/components/products/stock-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadStockBoard } from '@/features/inventory/queries/get-stock';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Stock',
  description: 'What is on hand, what it is worth and what needs reordering.',
  path: '/dashboard/products/stock',
  noIndex: true,
});

/**
 * Renders the stock screen.
 *
 * @returns The rendered page.
 */
export default async function StockPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'products', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock" description="You do not have access to the product book." />
        <Alert tone="warning" title="You cannot see stock">
          Ask the owner of this business to give your account permission to view products.
        </Alert>
      </div>
    );
  }

  const [board, formData] = await Promise.all([
    loadStockBoard(company.id),
    loadInvoiceFormData(company.id),
  ]);

  const products = formData.products.map((product) => ({ id: product.id, name: product.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description="Quantities and their value move together, so what this page says is what your accounts say."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="The stock position could not be read">
          Nothing has been changed. Reload before recording a movement.
        </Alert>
      ) : (
        <StockConsole
          warehouses={board.warehouses}
          levels={board.levels}
          movements={board.movements}
          lowStock={board.lowStock}
          totalValue={board.totalValue}
          products={products}
          canEdit={can(user, 'products', 'edit') && !company.isReadOnly}
          currency={company.baseCurrency}
        />
      )}
    </div>
  );
}
