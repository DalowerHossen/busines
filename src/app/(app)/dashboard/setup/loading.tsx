// src/app/(app)/dashboard/setup/loading.tsx
// The outline of the setup page while progress is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the setup skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function SetupLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading what is left to set up</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
