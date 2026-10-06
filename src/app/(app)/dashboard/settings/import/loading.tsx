// src/app/(app)/dashboard/settings/import/loading.tsx
// The outline of the import screen while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the import skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ImportLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the import screen</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <SkeletonTable rows={4} />
    </div>
  );
}
