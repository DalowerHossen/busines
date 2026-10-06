// src/app/(app)/dashboard/messages/page.tsx
// The outbox: what has gone to clients, what is waiting to go, and what a
// colleague has asked the owner to approve.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { MessagingNav } from '@/components/messaging/messaging-nav';
import { OutboxSummary } from '@/components/messaging/outbox-summary';
import { OutboxTable } from '@/components/messaging/outbox-table';
import { SendRequestTable } from '@/components/messaging/send-request-table';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadOutbox } from '@/features/messaging/queries/list-outbox';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Outbox',
  description: 'Every message sent to a client, and everything waiting to be approved.',
  path: ROUTES.messages,
  noIndex: true,
});

/**
 * Renders the outbox page.
 *
 * @returns The rendered page.
 */
export default async function MessagesPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Outbox" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const isOwner = user.role === 'owner' || user.role === 'super_admin';
  const outbox = await loadOutbox(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbox"
        description="Proof of what each client was told, and when. Only the owner sends to a client."
      />

      <MessagingNav />

      {outbox.isDegraded ? (
        <Alert tone="warning" title="The outbox could not be read just now">
          No message has been lost. Refresh the page in a moment.
        </Alert>
      ) : null}

      <OutboxSummary totals={outbox.totals} />

      <Card>
        <CardHeader>
          <CardTitle>Waiting for approval</CardTitle>
          <CardDescription>
            A colleague prepares the document and the wording; you decide whether it goes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SendRequestTable requests={outbox.requests} canApprove={isOwner} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent messages</CardTitle>
          <CardDescription>
            The last fifty messages, with delivery, opens and anything that failed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OutboxTable messages={outbox.messages} />
        </CardContent>
      </Card>
    </div>
  );
}
