// src/app/(admin)/admin/platform/page.tsx
// Running the installation itself: readiness, domains, health and the
// settings that can change while it runs.

import type { Metadata } from 'next';

import { PlatformOperationsConsole } from '@/components/admin/platform-operations-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadOperationsBoard } from '@/features/platform/queries/get-operations';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { releaseInfo } from '@/lib/platform/release';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Platform operations',
  description: 'Readiness, domains, health and the settings that change at runtime.',
  path: '/admin/platform',
  noIndex: true,
});

/**
 * Renders the operations console.
 *
 * @returns The rendered page.
 */
export default async function AdminPlatformPage() {
  await requireSuperAdmin();

  const board = await loadOperationsBoard();
  const release = releaseInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform operations"
        description={`Running build ${release.version} at commit ${release.commit}. Everything on this page can be changed without a deployment.`}
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="The console could not be read">
          Nothing has been changed. Reload before you edit a setting here.
        </Alert>
      ) : (
        <PlatformOperationsConsole board={board} />
      )}
    </div>
  );
}
