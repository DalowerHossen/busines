// src/app/(app)/dashboard/contracts/loading.tsx
// The outline of the agreement list while it is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the agreement list skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ContractsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the agreements</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
      <SkeletonTable rows={6} columns={5} />
    </div>
  );
}
