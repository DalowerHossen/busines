// src/app/(app)/dashboard/settings/storage/page.tsx
// Where an owner decides which drive holds the documents of the business.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SettingsNav } from '@/components/settings/settings-nav';
import { StorageConnectionPanel } from '@/components/settings/storage-connection-panel';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCompanyStorage } from '@/features/storage/queries/get-company-storage';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Document storage',
  description: 'Keep the files of your business in a cloud drive you own.',
  path: `${ROUTES.settings}/storage`,
  noIndex: true,
});

/**
 * Renders the document storage settings.
 *
 * @returns The rendered page.
 */
export default async function StorageSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Document storage"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  const storage = await loadCompanyStorage(company.id);
  const canManage = (user.role === 'owner' || user.role === 'super_admin') && !company.isReadOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document storage"
        description="We keep the words and the numbers of your business. You can keep the paperwork itself in a drive of your own."
      />

      <SettingsNav />

      {storage.isDegraded ? (
        <Alert tone="warning" title="This setting could not be read">
          Nothing has changed and uploads are unaffected. Reload the page in a moment.
        </Alert>
      ) : null}

      <StorageConnectionPanel storage={storage} canManage={canManage} />
    </div>
  );
}
