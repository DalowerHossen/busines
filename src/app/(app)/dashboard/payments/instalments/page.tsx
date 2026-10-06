// src/app/(app)/dashboard/payments/instalments/page.tsx
// Every arrangement where an invoice is being paid in parts.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { InstalmentPlanList } from '@/components/instalments/instalment-plan-list';
import { InstalmentSummary } from '@/components/instalments/instalment-summary';
import { PaymentsNav } from '@/components/payments/payments-nav';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadInstalmentPlans } from '@/features/instalments/queries/list-plans';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Instalments',
  description: 'Invoices being paid in parts, what has been collected and what is late.',
  path: `${ROUTES.payments}/instalments`,
  noIndex: true,
});

/**
 * Renders the instalment plans.
 *
 * @returns The rendered page.
 */
export default async function InstalmentsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Instalments"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'payments', 'view')) {
    return (
      <>
        <PageHeader title="Instalments" description="You do not have access to the money pages." />
        <Alert tone="warning" title="You cannot see instalments">
          Ask the owner of this business to give your account permission to view payments.
        </Alert>
      </>
    );
  }

  const result = await loadInstalmentPlans(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instalments"
        description="Letting a client pay over time turns a cash problem into a schedule. Every payment below is tracked, chased and reconciled against the invoice it belongs to."
        actions={
          user.role === 'owner' ? (
            <Link
              href={`${ROUTES.payments}/instalments/terms`}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Terms you offer
            </Link>
          ) : null
        }
      />

      <PaymentsNav />

      {result.isDegraded ? (
        <Alert tone="warning" title="The arrangements could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      <InstalmentSummary overview={result.overview} currency={company.baseCurrency} />

      <InstalmentPlanList plans={result.plans} />
    </div>
  );
}
