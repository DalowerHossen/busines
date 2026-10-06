// src/app/(app)/dashboard/marketing/social/loading.tsx
// The outline of the publishing screen while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the publishing skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function SocialPublishingLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading what is going out</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-52 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
