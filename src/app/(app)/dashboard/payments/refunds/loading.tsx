// src/app/(app)/dashboard/payments/refunds/loading.tsx
// The outline of the refund list while it is being read.

import { SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the refund list skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function RefundsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your refunds</span>
      <SkeletonTable rows={6} columns={5} />
    </div>
  );
}
