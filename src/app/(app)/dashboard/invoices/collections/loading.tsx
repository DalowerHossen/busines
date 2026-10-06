// src/app/(app)/dashboard/invoices/collections/loading.tsx
// The outline of the collections screen while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the collections skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function CollectionsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading what is owed to you</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>

      <Skeleton className="h-56 w-full rounded-lg" />
      <SkeletonTable rows={4} />
    </div>
  );
}
