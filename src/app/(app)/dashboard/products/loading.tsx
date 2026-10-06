// src/app/(app)/dashboard/products/loading.tsx
// The outline of the catalogue while it is being read, so the page does not
// jump when the rows arrive.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the catalogue skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ProductsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your catalogue</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {['total', 'active', 'services', 'tracked'].map((key) => (
          <Skeleton key={key} className="h-20 w-full rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-11 w-full max-w-md rounded-lg" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <SkeletonTable rows={8} columns={6} />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </div>
  );
}
