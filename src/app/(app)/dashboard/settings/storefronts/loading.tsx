// src/app/(app)/dashboard/settings/storefronts/loading.tsx
// The outline of the online shop page while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the online shop skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function StorefrontSettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your online shop settings</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>

      <Skeleton className="h-72 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
