// src/app/(affiliate)/affiliate/settings/page.tsx
// The details a partner keeps current, and the terms they are working under.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AffiliateProfileForm } from '@/components/affiliate/affiliate-profile-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadAffiliateWorkspace } from '@/features/affiliates/queries/get-affiliate';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Referral details',
  description: 'Your contact details and the terms of your referral agreement.',
  path: `${ROUTES.affiliate}/settings`,
  noIndex: true,
});

/**
 * Renders the partner details page.
 *
 * @returns The rendered page.
 */
export default async function AffiliateSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const workspace = await loadAffiliateWorkspace(user.id);

  if (workspace.profile === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Your details"
          description="This account has not joined the referral programme yet."
        />
        <Alert tone="info" title="Nothing to edit yet">
          Apply from the overview page and your details will appear here.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your details"
        description="Keep these current so we can pay you and reach you when something needs your attention."
      />

      <AffiliateProfileForm profile={workspace.profile} />
    </div>
  );
}
