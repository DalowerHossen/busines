// src/app/(app)/dashboard/marketing/campaigns/page.tsx
// Writing to clients, and seeing honestly how it went.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CampaignConsole } from '@/components/marketing/campaign-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCampaignBoard } from '@/features/campaigns/queries/get-campaigns';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Campaigns',
  description: 'Write to the clients who agreed to hear from you.',
  path: '/dashboard/marketing/campaigns',
  noIndex: true,
});

/**
 * Renders the campaign screen.
 *
 * @returns The rendered page.
 */
export default async function CampaignsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Campaigns"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'settings', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader title="Campaigns" description="You do not have access to what goes out." />
        <Alert tone="warning" title="You cannot see this">
          Ask the owner of this business to give your account permission to view settings.
        </Alert>
      </div>
    );
  }

  const board = await loadCampaignBoard(company.id);
  const isOwner = (user.role === 'owner' || user.role === 'super_admin') && !company.isReadOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Everything here reaches real people who agreed to hear from you. Writing is one decision; sending is the owner's."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="This could not be read">
          Nothing has been changed and nothing has been sent. Reload in a moment.
        </Alert>
      ) : (
        <CampaignConsole
          campaigns={board.campaigns}
          segments={board.segments}
          reach={board.reach}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}
