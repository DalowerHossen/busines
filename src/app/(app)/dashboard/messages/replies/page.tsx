// src/app/(app)/dashboard/messages/replies/page.tsx
// What came back on the channels that are not email, including every request
// to be left alone.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { InboundRepliesPanel } from '@/components/messaging/inbound-replies-panel';
import { MessagingNav } from '@/components/messaging/messaging-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadPendingReplies } from '@/features/messaging/queries/list-inbound';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Replies',
  description: 'Replies received on text and chat channels.',
  path: `${ROUTES.messages}/replies`,
  noIndex: true,
});

/**
 * Renders the replies page.
 *
 * @returns The rendered page.
 */
export default async function MessageRepliesPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Replies" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const { replies, isDegraded } = await loadPendingReplies(company.id);
  const canManage = user.role === 'owner' || can(user, 'clients', 'edit');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Replies"
        description="A client who texts back is talking to your business. A request to stop is acted on the second it arrives; everything else waits here until somebody has dealt with it."
      />

      <MessagingNav />

      {isDegraded ? (
        <Alert tone="warning" title="The replies could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      <InboundRepliesPanel replies={replies} canManage={canManage} />
    </div>
  );
}
