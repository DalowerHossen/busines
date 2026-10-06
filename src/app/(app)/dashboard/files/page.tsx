// src/app/(app)/dashboard/files/page.tsx
// Everything this business has stored, in one place.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { FileLibrary } from '@/components/files/file-library';
import { FileUploader } from '@/components/files/file-uploader';
import { StorageUsageCard } from '@/components/files/storage-usage-card';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadFileLibrary } from '@/features/files/queries/list-files';
import { FILE_PURPOSES } from '@/features/files/validation/files';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Files',
  description: 'Receipts, logos and anything else kept with this business.',
  path: ROUTES.files,
  noIndex: true,
});

export interface FilesPageProps {
  /** Filters taken from the address. */
  searchParams: { purpose?: string; search?: string };
}

/**
 * Renders the file library page.
 *
 * @param props The filters taken from the address.
 * @returns The rendered page.
 */
export default async function FilesPage({ searchParams }: FilesPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Files" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'files', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader title="Files" description="You do not have access to the file library." />
        <Alert tone="info" title="This part of the account is not open to you">
          Ask the owner of this business to give you access to files.
        </Alert>
      </div>
    );
  }

  const purpose = searchParams.purpose ?? null;
  const search = searchParams.search ?? null;
  const library = await loadFileLibrary(company.id, purpose, search);
  const canManage = can(user, 'files', 'edit') && !company.isReadOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Files"
        description="Receipts, logos and attachments live here. Every file is kept against this business alone, and every time one is opened it is written down."
      />

      {library.isDegraded ? (
        <Alert tone="warning" title="The file library could not be read">
          Nothing has been lost. Reload the page in a moment.
        </Alert>
      ) : null}

      <StorageUsageCard summary={library.summary} />

      {canManage ? (
        <FileUploader policy={library.policy} purposes={FILE_PURPOSES} />
      ) : (
        <Alert tone="info" title="You can read these files but not change them">
          Ask the owner of this business if you need to upload or remove anything.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stored files</CardTitle>
          <CardDescription>
            The sixty most recent files. Opening one is recorded against your name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileLibrary files={library.files} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
