// src/app/(app)/dashboard/marketplace/vendor/loading.tsx
// The outline of the vendor desk while it is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the vendor desk skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function VendorDeskLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the vendor desk</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
      <SkeletonTable rows={5} columns={6} />
    </div>
  );
}
