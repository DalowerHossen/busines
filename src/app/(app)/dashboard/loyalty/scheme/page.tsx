// src/app/(app)/dashboard/loyalty/scheme/page.tsx
// How points are earned, what they are worth, and what they buy.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoyaltyNav } from '@/components/loyalty/loyalty-nav';
import { LoyaltySchemeManager } from '@/components/loyalty/loyalty-scheme-manager';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadLoyaltyProgram } from '@/features/loyalty/queries/get-program';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Loyalty scheme',
  description: 'How points are earned, what they are worth and what they buy.',
  path: `${ROUTES.loyalty}/scheme`,
  noIndex: true,
});

/**
 * Renders the scheme settings.
 *
 * @returns The rendered page.
 */
export default async function LoyaltySchemePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Loyalty scheme"
          description="This account is not attached to a business yet."
        />
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
        <PageHeader
          title="Loyalty scheme"
          description="You do not have access to the client records."
        />
        <Alert tone="warning" title="You cannot see the loyalty scheme">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </>
    );
  }

  const scheme = await loadLoyaltyProgram(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="The scheme"
        description="Every point you award is money you have promised to give back, so the cost of the scheme is shown as you change it."
      />

      <LoyaltyNav />

      {scheme.isDegraded ? (
        <Alert tone="warning" title="The scheme could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      {company.isReadOnly ? (
        <Alert tone="warning" title="This business is read only">
          Members keep the points they hold, but the scheme cannot be changed while the account is
          in this state.
        </Alert>
      ) : null}

      <LoyaltySchemeManager
        program={scheme.program}
        rewards={scheme.rewards}
        currency={scheme.program?.currency ?? company.baseCurrency}
        canManage={user.role === 'owner' && !company.isReadOnly}
      />
    </div>
  );
}
