// src/app/(admin)/admin/affiliates/page.tsx
// The referral programme as the platform team sees it: who wants in, and how
// the partners already in it are performing.

import type { Metadata } from 'next';

import { AffiliateReviewQueue } from '@/components/admin/affiliate-review-queue';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadAffiliateDirectory } from '@/features/admin/queries/list-affiliates';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Referral partners',
  description: 'Referral applications waiting for a decision and the partners already earning.',
  path: '/admin/affiliates',
  noIndex: true,
});

/**
 * Renders the referral programme console.
 *
 * @returns The rendered page.
 */
export default async function AdminAffiliatesPage() {
  const directory = await loadAffiliateDirectory();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Referral partners"
        description="Approving a partner lets them earn on every business they send us. Check the promotion method before approving; incentivised signups cost more than they bring."
      />

      {directory.isDegraded ? (
        <Alert tone="warning" title="This list could not be read">
          Do not decide on an incomplete list. Reload in a moment.
        </Alert>
      ) : null}

      <AffiliateReviewQueue pending={directory.pending} active={directory.active} />
    </div>
  );
}
