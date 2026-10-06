// src/app/(app)/dashboard/team/loading.tsx
// The outline of the team page while the people are being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the team skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function TeamLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your team</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <SkeletonTable rows={5} columns={6} />
    </div>
  );
}
