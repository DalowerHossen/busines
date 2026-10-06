// src/app/(app)/dashboard/files/loading.tsx
// The outline of the file library while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the file library skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function FilesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your files</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
