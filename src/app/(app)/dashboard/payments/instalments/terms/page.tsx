// src/app/(app)/dashboard/payments/instalments/terms/page.tsx
// The terms this business is willing to be paid on.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { InstalmentTermsManager } from '@/components/instalments/instalment-terms-manager';
import { PaymentsNav } from '@/components/payments/payments-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadInstalmentOffers } from '@/features/instalments/queries/list-offers';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Instalment terms',
  description: 'The instalment terms this business offers its clients.',
  path: `${ROUTES.payments}/instalments/terms`,
  noIndex: true,
});

/**
 * Renders the instalment terms.
 *
 * @returns The rendered page.
 */
export default async function InstalmentTermsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Instalment terms"
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
        <PageHeader
          title="Instalment terms"
          description="You do not have access to the money pages."
        />
        <Alert tone="warning" title="You cannot see instalment terms">
          Ask the owner of this business to give your account permission to view payments.
        </Alert>
      </>
    );
  }

  const offers = await loadInstalmentOffers(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instalment terms"
        description="Deciding to be paid over time is a lending decision, so only the account owner can write these. Everything you set here is priced into the schedule before a client ever sees it."
      />

      <PaymentsNav />

      {company.isReadOnly ? (
        <Alert tone="warning" title="This business is read only">
          Existing arrangements carry on, but no new terms can be saved while the account is in this
          state.
        </Alert>
      ) : null}

      <InstalmentTermsManager
        offers={offers}
        currency={company.baseCurrency}
        canManage={user.role === 'owner' && !company.isReadOnly}
      />
    </div>
  );
}
