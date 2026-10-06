// src/app/(reseller)/reseller/earnings/page.tsx
// What the partner's book of accounts is worth to them.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { EarningsStatement } from '@/components/reseller/earnings-statement';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadResellerWorkspace } from '@/features/resellers/queries/get-reseller';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Partner earnings',
  description: 'The margin you have earned and the payments made to you.',
  path: `${ROUTES.reseller}/earnings`,
  noIndex: true,
});

/**
 * Renders the earnings page.
 *
 * @returns The rendered page.
 */
export default async function ResellerEarningsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const workspace = await loadResellerWorkspace(user.id);

  if (workspace.profile === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Earnings"
          description="This account is not part of the partner programme yet."
        />
        <Alert tone="info" title="Nothing to show yet">
          Apply from the overview page and your margin will be reported here.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        description="Your margin is the difference between what you bill an account and what we bill you."
      />

      <EarningsStatement
        statement={workspace.statement}
        payouts={workspace.payouts}
        currency={workspace.profile.billingCurrency}
      />
    </div>
  );
}
