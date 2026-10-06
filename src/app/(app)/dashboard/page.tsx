// src/app/(app)/dashboard/page.tsx
// The first page after signing in: what is owed, what has come in, what is
// still to do and the last few invoices.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { GettingStarted } from '@/components/dashboard/getting-started';
import { OverviewMetrics } from '@/components/dashboard/overview-metrics';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadDashboardOverview } from '@/features/dashboard/queries/overview';
import { loadOnboardingState } from '@/features/onboarding/queries/get-onboarding';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Dashboard',
  description: 'What is owed, what has been paid and what still needs doing.',
  path: ROUTES.dashboard,
  noIndex: true,
});

/**
 * Renders the dashboard.
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
          title={`Welcome, ${user.fullName}`}
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const [overview, onboarding] = await Promise.all([
    loadDashboardOverview(company.id, company.baseCurrency),
    loadOnboardingState(company.id),
  ]);

  // The steps come from the same source the setup page uses, so the two can
  // never tell the seller different things.
  const steps = onboarding.tasks
    .filter((task) => task.isRequired || task.isDismissed === false)
    .map((task) => ({
      key: task.key,
      title: task.title,
      description: task.description,
      isDone: task.isDone,
    }));

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.fullName.split(' ')[0] ?? user.fullName}`}
        description={`Here is where ${company.displayName} stands today.`}
      />

      {overview.isDegraded ? (
        <Alert tone="warning" title="Some figures could not be read">
          The page is showing everything that did load. Refresh in a moment, and write to support if
          it keeps happening.
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
