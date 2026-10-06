// src/app/(app)/dashboard/settings/webhooks/page.tsx
// Sending the events of this business to its own software.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SettingsNav } from '@/components/settings/settings-nav';
import { WebhookPanel } from '@/components/settings/webhook-panel';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadWebhookBoard } from '@/features/webhooks/queries/list-endpoints';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Event notifications',
  description: 'Have your own software told when something happens here.',
  path: `${ROUTES.settings}/webhooks`,
  noIndex: true,
});

/**
 * Renders the webhook settings.
 *
 * @returns The rendered page.
 */
export default async function WebhookSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Event notifications"
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
          title="Event notifications"
          description="You do not have access to the settings."
        />
        <Alert tone="warning" title="You cannot see this">
          Ask the owner of this business to give your account permission to view settings.
        </Alert>
      </div>
    );
  }

  const board = await loadWebhookBoard(company.id);
  const isOwner = (user.role === 'owner' || user.role === 'super_admin') && !company.isReadOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event notifications"
        description="Every message is signed, so your software can prove it came from us. A delivery that fails is retried, and one that never succeeds is kept so you can send it again."
      />

      <SettingsNav />

      {board.isDegraded ? (
        <Alert tone="warning" title="This could not be read">
          Nothing has changed and nothing has stopped being sent. Reload in a moment.
        </Alert>
      ) : (
        <WebhookPanel endpoints={board.endpoints} deliveries={board.deliveries} isOwner={isOwner} />
      )}
    </div>
  );
}
