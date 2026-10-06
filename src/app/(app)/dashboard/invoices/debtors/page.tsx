// src/app/(app)/dashboard/invoices/debtors/page.tsx
// Everybody who owes this business something, and their statements.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DebtorBoard } from '@/components/invoices/debtor-board';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadDebtors } from '@/features/statements/queries/get-statement';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Who owes you',
  description: 'Every client with something outstanding, oldest debt first.',
  path: '/dashboard/invoices/debtors',
  noIndex: true,
});

/**
 * Renders the debtor board.
 *
 * @returns The rendered page.
 */
export default async function DebtorsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Who owes you"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'invoices', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Who owes you"
          description="You do not have access to the invoice book."
        />
        <Alert tone="warning" title="You cannot see this">
          Ask the owner of this business to give your account permission to view invoices.
        </Alert>
      </div>
    );
  }

  const board = await loadDebtors(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Who owes you"
        description="Ordered by how long the money has been outstanding rather than by how much it is, because the oldest debt is the one most at risk."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="This could not be read">
          Nothing has changed. Reload before acting on these figures.
        </Alert>
      ) : (
        <DebtorBoard
          debtors={board.debtors}
          totalOutstanding={board.totalOutstanding}
          totalOverdue={board.totalOverdue}
          currency={company.baseCurrency}
        />
      )}
    </div>
  );
}
