// src/app/(app)/dashboard/expenses/suppliers/page.tsx
// Who this business buys from, and what it owes them.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SupplierConsole } from '@/components/expenses/supplier-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadPurchasingBoard } from '@/features/purchasing/queries/get-purchasing';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Suppliers',
  description: 'Who you buy from, what they have billed and what is still owed.',
  path: '/dashboard/expenses/suppliers',
  noIndex: true,
});

/**
 * Renders the supplier screen.
 *
 * @returns The rendered page.
 */
export default async function SuppliersPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Suppliers"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'expenses', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader title="Suppliers" description="You do not have access to what goes out." />
        <Alert tone="warning" title="You cannot see suppliers">
          Ask the owner of this business to give your account permission to view expenses.
        </Alert>
      </div>
    );
  }

  const board = await loadPurchasingBoard(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Money going out, recorded as carefully as money coming in. A payment is its own act, so a bill never quietly becomes settled."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="The supplier book could not be read">
          Nothing has been changed. Reload before recording a bill or a payment.
        </Alert>
      ) : (
        <SupplierConsole
          suppliers={board.suppliers}
          bills={board.bills}
          orders={board.orders}
          outstandingTotal={board.outstandingTotal}
          overdueTotal={board.overdueTotal}
          canEdit={can(user, 'expenses', 'edit') && !company.isReadOnly}
          currency={company.baseCurrency}
        />
      )}
    </div>
  );
}
