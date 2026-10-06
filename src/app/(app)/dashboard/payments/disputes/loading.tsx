// src/app/(app)/dashboard/payments/disputes/loading.tsx
// The outline of the dispute list while it is being read.

import { SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the dispute list skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function DisputesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your disputes</span>
      <SkeletonTable rows={5} columns={6} />
    </div>
  );
}
