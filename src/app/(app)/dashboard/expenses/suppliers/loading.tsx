// src/app/(app)/dashboard/expenses/suppliers/loading.tsx
// The outline of the supplier screen while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the supplier skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function SuppliersLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading what you owe your suppliers</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>

      <SkeletonTable rows={6} />
    </div>
  );
}
