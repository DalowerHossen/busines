// src/app/(admin)/admin/content/page.tsx
// The public website: its pages, their search metadata, and the addresses
// that have moved.

import type { Metadata } from 'next';

import { SiteContentConsole } from '@/components/admin/site-content-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadSiteBoard } from '@/features/site/queries/list-pages';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Website',
  description: 'The public pages, their search metadata and the addresses that moved.',
  path: '/admin/content',
  noIndex: true,
});

/**
 * Renders the website editor.
 *
 * @returns The rendered page.
 */
export default async function AdminContentPage() {
  await requireSuperAdmin();

  const board = await loadSiteBoard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website"
        description="Write a page, change what a search engine shows, move an address. None of it needs a deployment, and a page that moves keeps its old address working."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="The website editor could not be read">
          Nothing has been changed and the public site is unaffected. Reload in a moment.
        </Alert>
      ) : (
        <SiteContentConsole pages={board.pages} redirects={board.redirects} />
      )}
    </div>
  );
}
