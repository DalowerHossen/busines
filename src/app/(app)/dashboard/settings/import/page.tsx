// src/app/(app)/dashboard/settings/import/page.tsx
// Bringing clients and products in from whatever the business used before.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DataImportPanel } from '@/components/settings/data-import-panel';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadImportHistory } from '@/features/imports/queries/get-imports';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Bring your records in',
  description: 'Import clients and products from the tool you used before.',
  path: `${ROUTES.settings}/import`,
  noIndex: true,
});

/**
 * Renders the import screen.
 *
 * @returns The rendered page.
 */
export default async function ImportPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Bring your records in"
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
          title="Bring your records in"
          description="You do not have access to the settings."
        />
        <Alert tone="warning" title="You cannot see this">
          Ask the owner of this business to give your account permission to view settings.
        </Alert>
      </div>
    );
  }

  const history = await loadImportHistory(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bring your records in"
        description="Export a spreadsheet from your old tool and drop it here. Every import is rehearsed first, so nothing is written until you have seen exactly what would happen."
      />

      <SettingsNav />

      {history.isDegraded ? (
        <Alert tone="warning" title="The import history could not be read">
          You can still import. Reload if you want to see what was brought in before.
        </Alert>
      ) : null}

      <DataImportPanel
        runs={history.runs}
        canImport={can(user, 'clients', 'create') && !company.isReadOnly}
      />
    </div>
  );
}
