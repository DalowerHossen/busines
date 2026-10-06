// src/app/(admin)/admin/experiments/page.tsx
// Tests running on the public site, and what they have shown.

import type { Metadata } from 'next';

import { ExperimentConsole } from '@/components/admin/experiment-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadExperimentBoard } from '@/features/experiments/queries/list-experiments';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Tests',
  description: 'What is being tested on the public site, and what it has shown.',
  path: '/admin/experiments',
  noIndex: true,
});

/**
 * Renders the testing console.
 *
 * @returns The rendered page.
 */
export default async function AdminExperimentsPage() {
  await requireSuperAdmin();

  const board = await loadExperimentBoard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests"
        description="A visitor stays on the same side every time they come back, and a test that is running cannot be edited underneath them."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="The tests could not be read">
          Nothing has changed on the public site. Reload in a moment.
        </Alert>
      ) : (
        <ExperimentConsole experiments={board.experiments} variants={board.variants} />
      )}
    </div>
  );
}
