// src/app/(admin)/admin/content/loading.tsx
// The outline of the website editor while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the website editor skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminContentLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the public website</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}
