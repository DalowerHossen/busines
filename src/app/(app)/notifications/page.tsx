// src/app/(app)/notifications/page.tsx
// Everything the platform has told this account, newest first. The list is
// read on the server for the signed in person only; the centre itself is
// interactive so an item can be marked read without a round trip.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { NotificationCenter } from '@/features/dashboard/notification-center';
import { listNotifications } from '@/features/notifications/queries/list-notifications';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Notifications',
  description: 'Everything the platform has told this account.',
  path: '/notifications',
  noIndex: true,
});

/**
 * Renders the notification centre.
 *
 * @returns The rendered page.
 */
export default async function NotificationsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Notifications"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const notifications = await listNotifications(user.id, company.id);

  return <NotificationCenter initialNotifications={notifications} />;
}
