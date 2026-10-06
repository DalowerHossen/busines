// src/app/(app)/dashboard/products/stock/loading.tsx
// The outline of the stock screen while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the stock skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function StockLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the stock position</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <SkeletonTable rows={6} />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
