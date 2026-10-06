// src/app/(app)/dashboard/reports/loading.tsx
// The outline of the report library while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the report library skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ReportsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your reports</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {['one', 'two', 'three', 'four', 'five', 'six'].map((key) => (
          <Skeleton key={key} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
