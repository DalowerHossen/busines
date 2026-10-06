// src/app/(app)/dashboard/projects/timesheets/loading.tsx
// The outline of the timesheet screen while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the timesheet skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function TimesheetsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the weeks of work</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-32 w-full rounded-lg" />
      <SkeletonTable rows={5} />
    </div>
  );
}
