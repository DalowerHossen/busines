// src/app/(app)/dashboard/banking/feeds/loading.tsx
// The outline of the bank connections while it is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the the bank connections skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function BankFeedsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the bank connections</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
      <SkeletonTable rows={5} columns={4} />
    </div>
  );
}
