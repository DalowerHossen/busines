// src/app/(app)/dashboard/marketing/campaigns/loading.tsx
// The outline of the campaign screen while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the campaign skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function CampaignsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your campaigns</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>

      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
