// src/app/(app)/dashboard/settings/connected-apps/page.tsx
// What is connected to this account, what it can read, and how to stop it.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ConnectedAppList } from '@/components/developers/connected-app-list';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadConnectedApps } from '@/features/developers/queries/list-connected-apps';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Connected applications',
  description: 'The applications that may read this account, and how to stop them.',
  path: `${ROUTES.settings}/connected-apps`,
  noIndex: true,
});

/**
 * Renders the connected applications page.
 *
 * @returns The rendered page.
 */
export default async function ConnectedAppsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Connected applications"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'settings', 'view')) {
    return (
      <>
        <PageHeader
          title="Connected applications"
          description="You do not have access to the settings."
        />
        <Alert tone="warning" title="You cannot see the settings">
          Ask the owner of this business to give your account permission to view settings.
        </Alert>
      </>
    );
  }

  const { apps, isDegraded } = await loadConnectedApps(company.id);
  const canManage = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connected applications"
        description="Every application you have allowed into this account, what it may read, and how often it calls. Disconnecting one cancels its access immediately."
      />

      <SettingsNav />

      {isDegraded ? (
        <Alert tone="warning" title="The list could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      {canManage ? null : (
        <Alert tone="info" title="You are looking, not changing">
          Only the owner of this business can disconnect an application.
        </Alert>
      )}

      <ConnectedAppList apps={apps} canManage={canManage} />
    </div>
  );
}
