// src/app/(app)/dashboard/reports/books/page.tsx
// The books of the business: accounts, entries and the trial balance.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BooksConsole } from '@/components/reports/books-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadBooksBoard } from '@/features/accounting/queries/get-books';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'The books',
  description: 'Your chart of accounts, what has been posted and the trial balance.',
  path: '/dashboard/reports/books',
  noIndex: true,
});

/**
 * Renders the accounting screen.
 *
 * @returns The rendered page.
 */
export default async function BooksPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="The books"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'accounting', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader title="The books" description="You do not have access to the ledger." />
        <Alert tone="warning" title="You cannot see the books">
          Ask the owner of this business to give your account permission to view the accounting.
        </Alert>
      </div>
    );
  }

  const board = await loadBooksBoard(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="The books"
        description="Invoices, payments and expenses post themselves here. What you add by hand is for everything else, and nothing posted is ever edited."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="The books could not be read">
          Nothing has been posted or changed. Reload before acting on these figures.
        </Alert>
      ) : (
        <BooksConsole
          accounts={board.accounts}
          entries={board.entries}
          trialBalance={board.trialBalance}
          totalDebit={board.totalDebit}
          totalCredit={board.totalCredit}
          isBalanced={board.isBalanced}
          canEdit={can(user, 'accounting', 'edit') && !company.isReadOnly}
          currency={company.baseCurrency}
        />
      )}
    </div>
  );
}
