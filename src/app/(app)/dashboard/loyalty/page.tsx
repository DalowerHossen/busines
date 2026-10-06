// src/app/(app)/dashboard/loyalty/page.tsx
// Who is collecting points, how many they hold, and what that costs.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoyaltyMemberTable } from '@/components/loyalty/loyalty-member-table';
import { LoyaltyNav } from '@/components/loyalty/loyalty-nav';
import { LoyaltySummary } from '@/components/loyalty/loyalty-summary';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadLoyaltyProgram } from '@/features/loyalty/queries/get-program';
import { loadLoyaltyMembers } from '@/features/loyalty/queries/list-members';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Loyalty',
  description: 'The clients collecting points, what they hold and what it is worth.',
  path: ROUTES.loyalty,
  noIndex: true,
});

/**
 * Renders the loyalty members.
 *
 * @returns The rendered page.
 */
export default async function LoyaltyPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Loyalty" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'clients', 'view')) {
    return (
      <>
        <PageHeader title="Loyalty" description="You do not have access to the client records." />
        <Alert tone="warning" title="You cannot see the loyalty scheme">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </>
    );
  }

  const [scheme, members] = await Promise.all([
    loadLoyaltyProgram(company.id),
    loadLoyaltyMembers(company.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loyalty and reviews"
        description="A client who comes back is cheaper than one you have to find. Points are kept like money here, because that is exactly what they are until they are spent."
      />

      <LoyaltyNav />

      {scheme.isDegraded ? (
        <Alert tone="warning" title="The scheme could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      {scheme.program === null ? (
        <Alert tone="info" title="No scheme is running yet">
          Open the scheme tab to decide how points are earned and what they buy. Nothing is given
          away until you switch it on.
        </Alert>
      ) : null}

      <LoyaltySummary
        overview={scheme.overview}
        currency={scheme.program?.currency ?? company.baseCurrency}
      />

      <LoyaltyMemberTable
        members={members}
        currency={scheme.program?.currency ?? company.baseCurrency}
      />
    </div>
  );
}
