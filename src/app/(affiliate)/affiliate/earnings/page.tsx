// src/app/(affiliate)/affiliate/earnings/page.tsx
// What a partner has earned and how it reaches their bank.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CommissionTable } from '@/components/affiliate/commission-table';
import { PayoutRequestForm } from '@/components/affiliate/payout-request-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadAffiliateWorkspace } from '@/features/affiliates/queries/get-affiliate';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Referral earnings',
  description: 'Commissions earned through the referral programme and the payouts made.',
  path: `${ROUTES.affiliate}/earnings`,
  noIndex: true,
});

/**
 * Renders the earnings page.
 *
 * @returns The rendered page.
 */
export default async function AffiliateEarningsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const workspace = await loadAffiliateWorkspace(user.id);

  if (workspace.profile === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Referral earnings"
          description="This account has not joined the referral programme yet."
        />
        <Alert tone="info" title="Nothing to show yet">
          Apply from the overview page and your earnings will appear here.
        </Alert>
      </div>
    );
  }

  const profile = workspace.profile;
  const summary = workspace.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral earnings"
        description="A commission is held until the refund window on the underlying payment has passed, then released to your balance."
      />

      <PayoutRequestForm
        availableAmount={summary?.walletAvailable ?? '0'}
        minimumAmount={profile.minimumPayoutAmount}
        currency={profile.payoutCurrency}
        payouts={workspace.payouts}
        isApproved={profile.status === 'approved'}
      />

      <CommissionTable commissions={workspace.commissions} currency={profile.payoutCurrency} />
    </div>
  );
}
