// src/app/(app)/dashboard/settings/integrations/page.tsx
// The services this business connects with its own keys.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { IntegrationManager } from '@/components/integrations/integration-manager';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadIntegrations } from '@/features/integrations/queries/list-integrations';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Your connections',
  description: 'Connect your own accounts with your own keys.',
  path: `${ROUTES.settings}/integrations`,
  noIndex: true,
});

/**
 * Renders the tenant integration settings.
 *
 * @returns The rendered page.
 */
export default async function IntegrationSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Your connections"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Your connections"
          description="Only the owner of this business can hold its keys."
        />
        <SettingsNav />
        <Alert tone="info" title="This is the owner's decision">
          Keys give access to money and to client data, so they are kept to the owner of the
          business.
        </Alert>
      </div>
    );
  }

  const board = await loadIntegrations(company.id);
  const tenantConfigurable = board.integrations.filter(
    (integration) => integration.configurableBy !== 'platform'
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your connections"
        description="Use your own accounts where you prefer to. Anything you leave empty keeps running on the platform connection."
      />

      <SettingsNav />

      {board.isDegraded ? (
        <Alert tone="warning" title="Your connections could not be read">
          Nothing has been changed. Reload before you save a key here.
        </Alert>
      ) : (
        <IntegrationManager integrations={tenantConfigurable} isPlatformScope={false} />
      )}
    </div>
  );
}
