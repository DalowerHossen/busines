// src/app/(admin)/admin/listings/page.tsx
// The platform console for the template marketplace: who may sell, and what
// may go on sale.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ListingReviewQueue } from '@/components/admin/listing-review-queue';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadListingQueue } from '@/features/admin/queries/list-listing-queue';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Marketplace review',
  description: 'Vendors and listings waiting for a decision.',
  path: `${ROUTES.admin}/listings`,
  noIndex: true,
});

/**
 * Renders the marketplace console.
 *
 * @returns The rendered page.
 */
export default async function AdminListingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  if (user.role !== 'super_admin') {
    redirect(ROUTES.dashboard);
  }

  const queue = await loadListingQueue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template marketplace"
        description="Everything sold here runs inside somebody else's business, so nothing reaches the shopfront until it has been read."
      />

      {queue.isDegraded ? (
        <Alert tone="warning" title="Part of the queue could not be read">
          Decisions already made are safe. Reload the page before deciding anything else.
        </Alert>
      ) : null}

      <ListingReviewQueue listings={queue.listings} vendors={queue.vendors} />
    </div>
  );
}
