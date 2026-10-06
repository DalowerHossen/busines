// src/app/(app)/dashboard/payouts/loading.tsx
// The outline of the payout page while the balance is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the payout skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function PayoutsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your balance</span>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['one', 'two', 'three', 'four'].map((key) => (
          <Skeleton key={key} className="h-28 w-full rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-48 w-full rounded-lg" />
      <SkeletonTable rows={5} columns={5} />
    </div>
  );
}
