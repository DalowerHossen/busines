// src/app/(admin)/admin/integrations/page.tsx
// Every service the platform talks to, and the keys it talks with.

import type { Metadata } from 'next';

import { IntegrationManager } from '@/components/integrations/integration-manager';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadIntegrations } from '@/features/integrations/queries/list-integrations';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Connections',
  description: 'The services this platform talks to, and the keys it talks with.',
  path: '/admin/integrations',
  noIndex: true,
});

/**
 * Renders the platform integration console.
 *
 * @returns The rendered page.
 */
export default async function AdminIntegrationsPage() {
  await requireSuperAdmin();

  const board = await loadIntegrations(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Keys are encrypted before they are stored, applied within seconds, and never shown again. Nothing here needs a deployment to change."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="The connections could not be read">
          Nothing has been changed. Reload before you save a key here.
        </Alert>
      ) : (
        <IntegrationManager integrations={board.integrations} isPlatformScope />
      )}
    </div>
  );
}
