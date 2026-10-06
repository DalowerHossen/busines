// src/app/(affiliate)/affiliate/page.tsx
// Where a referral partner starts: the traffic they sent, the accounts it
// opened, and the links that did the work.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AffiliateStats } from '@/components/affiliate/affiliate-stats';
import { ApplicationForm } from '@/components/affiliate/application-form';
import { ReferralLinksPanel } from '@/components/affiliate/referral-links-panel';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadAffiliateWorkspace } from '@/features/affiliates/queries/get-affiliate';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Referral programme',
  description: 'Traffic you sent us, accounts it opened and the links behind them.',
  path: ROUTES.affiliate,
  noIndex: true,
});

/**
 * Renders the referral overview.
 *
 * @returns The rendered page.
 */
export default async function AffiliateOverviewPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const workspace = await loadAffiliateWorkspace(user.id);

  if (workspace.profile === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Referral programme"
          description="Send businesses our way and earn a share of everything they pay, month after month."
        />

        <ApplicationForm defaultEmail={user.email} defaultName={user.fullName ?? ''} />
      </div>
    );
  }

  const profile = workspace.profile;
  const isApproved = profile.status === 'approved';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral programme"
        description={`You earn ${profile.commissionPercentage}% of what every business you refer pays us.`}
      />

      {workspace.isDegraded ? (
        <Alert tone="warning" title="Some figures could not be read">
          The totals below may be behind. Reload in a moment.
        </Alert>
      ) : null}

      {profile.status === 'pending_review' ? (
        <Alert tone="info" title="Your application is with us">
          We look at every application by hand, usually within two working days. Your link is ready
          and starts counting the moment we approve you.
        </Alert>
      ) : null}

      {profile.status === 'suspended' ? (
        <Alert tone="warning" title="This account is paused">
          {profile.suspensionReason ?? 'Write to support and we will explain what is needed.'}
        </Alert>
      ) : null}

      {profile.status === 'terminated' ? (
        <Alert tone="danger" title="This account is closed">
          {profile.rejectionReason ?? 'Write to support if you believe this is a mistake.'}
        </Alert>
      ) : null}

      {workspace.summary ? <AffiliateStats summary={workspace.summary} /> : null}

      <ReferralLinksPanel links={workspace.links} isApproved={isApproved} />
    </div>
  );
}
