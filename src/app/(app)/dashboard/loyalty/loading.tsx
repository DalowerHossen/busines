// src/app/(app)/dashboard/loyalty/loading.tsx
// The outline of the loyalty pages while they are being read.

import { SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the loyalty skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function LoyaltyLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the loyalty scheme</span>
      <SkeletonTable rows={5} columns={6} />
    </div>
  );
}
