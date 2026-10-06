// src/app/(app)/dashboard/marketing/social/page.tsx
// What this business says in public, and when it says it.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SocialPublishingConsole } from '@/components/marketing/social-publishing-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadPublishingBoard } from '@/features/social/queries/get-publishing';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Social publishing',
  description: 'Write, approve and schedule what your business says in public.',
  path: '/dashboard/marketing/social',
  noIndex: true,
});

/**
 * Renders the publishing screen.
 *
 * @returns The rendered page.
 */
export default async function SocialPublishingPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Social publishing"
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
        <PageHeader
          title="Social publishing"
          description="You do not have access to what this business publishes."
        />
        <Alert tone="warning" title="You cannot see this">
          Ask the owner of this business to give your account permission to view settings.
        </Alert>
      </div>
    );
  }

  const board = await loadPublishingBoard(company.id);
  const isOwner = (user.role === 'owner' || user.role === 'super_admin') && !company.isReadOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social publishing"
        description="Everything here is a draft until the owner has read it. Connected accounts hold an encrypted token that is never shown again."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="This could not be read">
          Nothing has been changed and nothing has been published. Reload in a moment.
        </Alert>
      ) : (
        <SocialPublishingConsole
          channels={board.channels}
          posts={board.posts}
          rules={board.rules}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}
