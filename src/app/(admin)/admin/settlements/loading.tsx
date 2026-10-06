// src/app/(admin)/admin/settlements/loading.tsx
// The outline of the settlement console while the figures are read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the settlement console skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminSettlementsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the collection terms</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>

      <Skeleton className="h-56 w-full rounded-lg" />
      <SkeletonTable rows={5} />
    </div>
  );
}
