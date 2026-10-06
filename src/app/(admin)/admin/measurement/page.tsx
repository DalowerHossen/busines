// src/app/(admin)/admin/measurement/page.tsx
// How this website is measured, and what loads only with consent.

import type { Metadata } from 'next';

import { MeasurementConsole } from '@/components/admin/measurement-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadDestinations } from '@/features/analytics/queries/list-destinations';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Measurement',
  description: 'Where this website reports, and what each destination needs consent for.',
  path: '/admin/measurement',
  noIndex: true,
});

/**
 * Renders the measurement console.
 *
 * @returns The rendered page.
 */
export default async function AdminMeasurementPage() {
  await requireSuperAdmin();

  const board = await loadDestinations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Measurement"
        description="Add an analytics property or an advertising pixel without a deployment. Each one waits for the consent category it belongs to."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="The destinations could not be read">
          Nothing has been changed and nothing has stopped reporting. Reload in a moment.
        </Alert>
      ) : (
        <MeasurementConsole destinations={board.destinations} />
      )}
    </div>
  );
}
