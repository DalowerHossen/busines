// src/app/(admin)/admin/verification/page.tsx
// Identity checks waiting on the platform team. Approving one is what makes
// us the merchant of record for that business, so the papers and the answers
// are shown side by side.

import type { Metadata } from 'next';

import { KycReviewQueue } from '@/components/admin/kyc-review-queue';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadKycQueue } from '@/features/admin/queries/list-kyc-queue';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Verification',
  description: 'Identity checks waiting for a decision from the platform team.',
  path: '/admin/verification',
  noIndex: true,
});

/**
 * Renders the identity check queue.
 *
 * @returns The rendered page.
 */
export default async function AdminVerificationPage() {
  const queue = await loadKycQueue();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Verification"
        description="Read the papers against the answers before verifying. Verifying switches card settlement on for that business; sending a check back tells the owner exactly what is missing."
      />

      {queue.isDegraded ? (
        <Alert tone="warning" title="This queue could not be read">
          Do not decide on an incomplete list. Reload in a moment.
        </Alert>
      ) : null}

      <KycReviewQueue items={queue.items} recent={queue.recent} />
    </div>
  );
}
