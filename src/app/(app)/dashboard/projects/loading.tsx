// src/app/(app)/dashboard/projects/loading.tsx
// The outline of the project board while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the project skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ProjectsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your projects</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
