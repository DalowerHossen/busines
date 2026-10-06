// src/app/(app)/dashboard/messages/routes/page.tsx
// The order a reminder travels in, and what happened to the ones that have
// already gone out.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { MessagingNav } from '@/components/messaging/messaging-nav';
import { RouteActivityTable } from '@/components/messaging/route-activity-table';
import { RouteBuilder } from '@/components/messaging/route-builder';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadMessageRoutes } from '@/features/messaging/queries/list-routes';
import { loadRouteActivity } from '@/features/messaging/queries/list-route-activity';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Fallback chains',
  description: 'How a reminder moves from one channel to the next until it lands.',
  path: `${ROUTES.messages}/routes`,
  noIndex: true,
});

/**
 * Renders the fallback chains page.
 *
 * @returns The rendered page.
 */
export default async function MessageRoutesPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Fallback chains"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const [routes, activity] = await Promise.all([
    loadMessageRoutes(company.id),
    loadRouteActivity(company.id),
  ]);

  const canManage = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fallback chains"
        description="Email first, then a text message a day later, then a chat message. The chain stops the moment one of them lands, so nobody is chased twice about the same thing."
      />

      <MessagingNav />

      {routes.isDegraded || activity.isDegraded ? (
        <Alert tone="warning" title="Some of this page could not be read">
          Nothing has been changed. Try again in a moment before you edit anything.
        </Alert>
      ) : null}

      <RouteBuilder routes={routes.routes} canManage={canManage} />

      <Card>
        <CardHeader>
          <CardTitle>What the chains have done</CardTitle>
          <CardDescription>
            Each conversation, the channels it tried, and what it cost to get through.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RouteActivityTable
            runs={activity.runs}
            currency={company.baseCurrency}
            canManage={canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
