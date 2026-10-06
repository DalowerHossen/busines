// src/app/(reseller)/reseller/page.tsx
// Where a white label partner starts: the size of the book they hold and
// what it earns them.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PartnerApplicationForm } from '@/components/reseller/partner-application-form';
import { ResellerStats } from '@/components/reseller/reseller-stats';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadResellerWorkspace } from '@/features/resellers/queries/get-reseller';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Partner programme',
  description: 'Sell the platform under your own brand and keep the margin.',
  path: ROUTES.reseller,
  noIndex: true,
});

/**
 * Renders the partner overview.
 *
 * @returns The rendered page.
 */
export default async function ResellerOverviewPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const workspace = await loadResellerWorkspace(user.id);

  if (workspace.profile === null) {
    const company = user.companyId ? await loadCompany(user.companyId) : null;

    return (
      <div className="space-y-6">
        <PageHeader
          title="Partner programme"
          description="Open accounts for your clients under your own brand, set your own prices and keep the difference."
        />

        <PartnerApplicationForm
          defaultEmail={user.email}
          defaultCountry={company?.countryCode ?? 'US'}
        />
      </div>
    );
  }

  const profile = workspace.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner programme"
        description={`You keep ${profile.revenueSharePercentage}% of what the accounts you manage pay.`}
      />

      {workspace.isDegraded ? (
        <Alert tone="warning" title="Some figures could not be read">
          The totals below may be behind. Reload in a moment.
        </Alert>
      ) : null}

      {profile.status === 'pending_review' ? (
        <Alert tone="info" title="Your application is with us">
          We review each partner by hand, usually within two working days. You can set your brand up
          in the meantime.
        </Alert>
      ) : null}

      {profile.status === 'suspended' ? (
        <Alert tone="warning" title="This partner account is paused">
          Existing accounts keep working. You cannot open new ones until this is lifted.
        </Alert>
      ) : null}

      {profile.status === 'terminated' ? (
        <Alert tone="danger" title="This partner agreement has ended">
          {profile.rejectionReason ?? 'Write to support if you believe this is a mistake.'}
        </Alert>
      ) : null}

      {workspace.statement ? <ResellerStats statement={workspace.statement} /> : null}
    </div>
  );
}
