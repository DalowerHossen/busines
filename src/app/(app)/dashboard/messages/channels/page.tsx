// src/app/(app)/dashboard/messages/channels/page.tsx
// Where a business decides how it reaches people when email is not being
// read: which channels it can use, what each one costs, and when it is
// allowed to send.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ChannelManager } from '@/components/messaging/channel-manager';
import { MessagingNav } from '@/components/messaging/messaging-nav';
import { MessagingSummary } from '@/components/messaging/messaging-summary';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadMessagingChannels } from '@/features/messaging/queries/list-channels';
import { loadMessagingOverview } from '@/features/messaging/queries/get-messaging-overview';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Messaging channels',
  description: 'The ways this business reaches people besides email.',
  path: `${ROUTES.messages}/channels`,
  noIndex: true,
});

/**
 * Renders the channels page.
 *
 * @returns The rendered page.
 */
export default async function MessagingChannelsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Messaging channels"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const [{ channels, isDegraded }, overview] = await Promise.all([
    loadMessagingChannels(company.id),
    loadMessagingOverview(company.id),
  ]);

  const canManage = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messaging channels"
        description="A reminder that is not read is not a reminder. Set up a text message or chat channel, prove it works, and your reminders can follow a client to wherever they actually look."
      />

      <MessagingNav />

      {isDegraded ? (
        <Alert tone="warning" title="The channels could not be read">
          Nothing has been changed. Try again in a moment before you edit anything.
        </Alert>
      ) : null}

      <MessagingSummary overview={overview} currency={company.baseCurrency} />

      <ChannelManager channels={channels} canManage={canManage} />
    </div>
  );
}
