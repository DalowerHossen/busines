// src/app/(admin)/admin/storage/page.tsx
// Where the platform team decides where files are kept.

import type { Metadata } from 'next';

import { StorageTargetManager } from '@/components/admin/storage-target-manager';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadStorageTargets } from '@/features/storage/queries/list-targets';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'File storage',
  description: 'The places the platform keeps files, and whether they are answering.',
  path: '/admin/storage',
  noIndex: true,
});

/**
 * Renders the storage console.
 *
 * @returns The rendered page.
 */
export default async function AdminStoragePage() {
  const { targets, isDegraded } = await loadStorageTargets();
  const unhealthy = targets.filter((target) => target.lastError !== null);
  const unkeyed = targets.filter((target) => !target.hasCredentials && target.isActive);

  return (
    <div className="space-y-8">
      <PageHeader
        title="File storage"
        description="Receipts, logos and signed documents all land in one of these stores. Keys can be replaced here at any time and apply to the very next upload, with no deployment."
      />

      {isDegraded ? (
        <Alert tone="warning" title="This list could not be read">
          Do not change anything on an incomplete list. Reload in a moment.
        </Alert>
      ) : null}

      {unhealthy.length > 0 ? (
        <Alert tone="danger" title="A store is not answering">
          {`${String(unhealthy.length)} store or stores reported an error on their last call. Test them below before the next upload finds out the hard way.`}
        </Alert>
      ) : null}

      {unkeyed.length > 0 ? (
        <Alert tone="warning" title="A store is switched on but has no keys">
          Add the keys before anybody uploads to it, or switch it off until it is ready.
        </Alert>
      ) : null}

      <StorageTargetManager targets={targets} />
    </div>
  );
}
