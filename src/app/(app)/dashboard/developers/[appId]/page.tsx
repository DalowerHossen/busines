// src/app/(app)/dashboard/developers/[appId]/page.tsx
// One application: its credentials, how it presents itself, what it may ask
// for, and which accounts are using it.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { AppDetailPanel } from '@/components/developers/app-detail-panel';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadDeveloperApp } from '@/features/developers/queries/get-app';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Application',
  description: 'The credentials and permissions of one application.',
  path: `${ROUTES.dashboard}/developers`,
  noIndex: true,
});

export interface DeveloperAppPageProps {
  /** Route parameters of the page. */
  params: { appId: string };
}

/**
 * Renders one application.
 *
 * @param props Route parameters of the page.
 * @returns The rendered page.
 */
export default async function DeveloperAppPage({ params }: DeveloperAppPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    redirect(`${ROUTES.dashboard}/developers`);
  }

  const app = await loadDeveloperApp(params.appId);

  if (app === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={app.appName}
        description={
          app.tagline ?? 'Everything this application needs in order to connect, in one place.'
        }
      />

      <AppDetailPanel app={app} />
    </div>
  );
}
