// src/app/(accountant)/accountant/page.tsx
// Where a bookkeeper starts: every business that invited them, and what each
// one needs.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { WorkspaceList } from '@/components/accountant/workspace-list';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadAccountantWorkspaces } from '@/features/accountants/queries/list-workspaces';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Bookkeeping',
  description: 'The businesses you keep the books for, in one place.',
  path: ROUTES.accountant,
  noIndex: true,
});

/**
 * Renders the list of businesses an accountant works on.
 *
 * @returns The rendered page.
 */
export default async function AccountantHomePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const { workspaces, isDegraded } = await loadAccountantWorkspaces();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your businesses"
        description="One login, every set of books you are responsible for. Owners decide what you may see and can withdraw access at any time."
      />

      {isDegraded ? (
        <Alert tone="warning" title="The list could not be read">
          Nothing is wrong with the books themselves. Reload the page in a moment.
        </Alert>
      ) : null}

      <WorkspaceList workspaces={workspaces} />
    </div>
  );
}
