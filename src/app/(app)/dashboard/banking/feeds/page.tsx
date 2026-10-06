// src/app/(app)/dashboard/banking/feeds/page.tsx
// The connections that bring statement lines in: how healthy each one is,
// how long its consent has left, and which account it writes into.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankingNav } from '@/components/banking/banking-nav';
import { FeedManager } from '@/components/banking/feed-manager';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadFeedAccounts } from '@/features/banking/queries/list-feed-accounts';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Bank connections',
  description: 'The banks this business reads statements from.',
  path: `${ROUTES.banking}/feeds`,
  noIndex: true,
});

/**
 * Renders the bank connections page.
 *
 * @returns The rendered page.
 */
export default async function BankFeedsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Bank connections"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'banking', 'view')) {
    return (
      <>
        <PageHeader
          title="Bank connections"
          description="You do not have access to the banking records."
        />
        <Alert tone="warning" title="You cannot see the banking records">
          Ask the owner of this business to give your account permission to view banking.
        </Alert>
      </>
    );
  }

  const { connections, accounts, ledgerAccounts, isDegraded } = await loadFeedAccounts(company.id);

  const canManage = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank connections"
        description="A bank feed saves somebody exporting a file every week. Consent to read an account is time limited by law, so the countdown is shown here rather than discovered when the feed stops."
      />

      <BankingNav />

      {isDegraded ? (
        <Alert tone="warning" title="The connections could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      <FeedManager
        connections={connections}
        accounts={accounts}
        ledgerAccounts={ledgerAccounts}
        canManage={canManage}
      />
    </div>
  );
}
