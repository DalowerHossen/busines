// src/app/(app)/dashboard/page.tsx
// What a business sees first: what it is owed, what is late, what came in
// this month, and the documents raised most recently. Every figure is read
// for the signed in company only, and a read that fails says so instead of
// showing a confident zero.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { GettingStarted } from '@/components/dashboard/getting-started';
import { OverviewMetrics } from '@/components/dashboard/overview-metrics';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadDashboardOverview } from '@/features/dashboard/queries/overview';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Dashboard',
  description: 'What this business is owed, what is late and what came in this month.',
  path: ROUTES.dashboard,
  noIndex: true,
});

/**
 * Renders the business dashboard.
 *
 * @returns The rendered page.
 */
export default async function DashboardPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const overview = await loadDashboardOverview(company.id, company.baseCurrency);

  const steps = [
    {
      key: 'company',
      title: 'Describe the business',
      description: 'Your legal name, address and tax details appear on every document.',
      isDone: company.status !== 'onboarding',
    },
    {
      key: 'clients',
      title: 'Add your first client',
      description: 'A client is a billing record, not an account, so there is nothing to invite.',
      isDone: overview.clientCount > 0,
    },
    {
      key: 'invoice',
      title: 'Raise your first invoice',
      description: 'Send it by email and the client pays online without signing in.',
      isDone: overview.invoiceCount > 0,
    },
    {
      key: 'payments',
      title: 'Turn on online payment',
      description: 'Connect a gateway so a client can pay the moment they open the document.',
      isDone: company.kycStatus === 'verified',
    },
  ];

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.fullName.split(' ')[0] ?? user.fullName}`}
        description={`Everything below is for ${company.displayName}, in ${company.baseCurrency}.`}
      />

      {overview.isDegraded ? (
        <Alert tone="warning" title="Some figures could not be read">
          Nothing is lost. One of the reads did not come back, so a number below may be incomplete.
          Refresh in a moment.
        </Alert>
      ) : null}

      <OverviewMetrics overview={overview} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RecentInvoices invoices={overview.recentInvoices} />
        <GettingStarted steps={steps} />
      </div>
    </>
  );
}
