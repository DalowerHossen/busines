// src/app/(admin)/admin/apps/page.tsx
// The platform console for third party applications: who may connect to
// customer accounts, and with what reach.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AppReviewQueue } from '@/components/admin/app-review-queue';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadAppQueue } from '@/features/admin/queries/list-app-queue';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Application review',
  description: 'Third party applications waiting for a decision.',
  path: `${ROUTES.admin}/apps`,
  noIndex: true,
});

/**
 * Renders the application review console.
 *
 * @returns The rendered page.
 */
export default async function AdminAppsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  if (user.role !== 'super_admin') {
    redirect(ROUTES.dashboard);
  }

  const { entries, isDegraded } = await loadAppQueue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application review"
        description="An approved application can hold a token for any account that allows it, so grant only the permissions it has a reason to hold."
      />

      {isDegraded ? (
        <Alert tone="warning" title="The queue could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      <AppReviewQueue entries={entries} />
    </div>
  );
}
