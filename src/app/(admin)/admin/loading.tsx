// src/app/(admin)/admin/loading.tsx
// The outline of the platform overview while the figures are read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the overview skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminOverviewLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the platform figures</span>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
          <Skeleton key={key} className="h-28 w-full rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
