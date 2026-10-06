// src/app/(app)/dashboard/expenses/receipts/loading.tsx
// The outline of the receipt queue while it is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the receipt queue skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ReceiptsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the receipts</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
      <SkeletonTable rows={4} columns={3} />
    </div>
  );
}
