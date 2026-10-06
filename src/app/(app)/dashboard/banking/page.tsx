// src/app/(app)/dashboard/banking/page.tsx
// Reconciliation: every line the bank has sent that nobody has explained
// yet, with the records that could explain it already offered.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankingNav } from '@/components/banking/banking-nav';
import { BankingSummary } from '@/components/banking/banking-summary';
import { ReconciliationQueue } from '@/components/banking/reconciliation-queue';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadBankingOverview } from '@/features/banking/queries/get-banking-overview';
import { loadReviewQueue } from '@/features/banking/queries/list-review-queue';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Reconciliation',
  description: 'Match what the bank reported against what the books say.',
  path: ROUTES.banking,
  noIndex: true,
});

/**
 * Renders the reconciliation page.
 *
 * @returns The rendered page.
 */
export default async function BankingPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Reconciliation"
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
          title="Reconciliation"
          description="You do not have access to the banking records."
        />
        <Alert tone="warning" title="You cannot see the banking records">
          Ask the owner of this business to give your account permission to view banking.
        </Alert>
      </>
    );
  }

  const [overview, queue] = await Promise.all([
    loadBankingOverview(company.id),
    loadReviewQueue(company.id),
  ]);

  const canDecide = user.role === 'owner' || can(user, 'banking', 'edit');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Every line the bank sent, matched against what the books already know. The engine learns from each decision, so the same counterparty is recognised next month."
      />

      <BankingNav />

      {queue.isDegraded ? (
        <Alert tone="warning" title="The queue could not be read">
          Nothing has been changed. Try again in a moment before you settle anything.
        </Alert>
      ) : null}

      <BankingSummary overview={overview} currency={company.baseCurrency} />

      <ReconciliationQueue entries={queue.entries} canDecide={canDecide} />
    </div>
  );
}
