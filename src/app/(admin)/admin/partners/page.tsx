// src/app/(admin)/admin/partners/page.tsx
// The white label programme as the platform team sees it.

import type { Metadata } from 'next';

import { PartnerReviewQueue } from '@/components/admin/partner-review-queue';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadResellerDirectory } from '@/features/admin/queries/list-resellers';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'White label partners',
  description: 'Partner applications waiting for a decision and the partners already selling.',
  path: '/admin/partners',
  noIndex: true,
});

/**
 * Renders the white label console.
 *
 * @returns The rendered page.
 */
export default async function AdminPartnersPage() {
  const directory = await loadResellerDirectory();

  return (
    <div className="space-y-8">
      <PageHeader
        title="White label partners"
        description="Approving a partner lets them open accounts that bill through them. Set the revenue share and the account ceiling at the same time."
      />

      {directory.isDegraded ? (
        <Alert tone="warning" title="This list could not be read">
          Do not decide on an incomplete list. Reload in a moment.
        </Alert>
      ) : null}

      <PartnerReviewQueue pending={directory.pending} active={directory.active} />
    </div>
  );
}
