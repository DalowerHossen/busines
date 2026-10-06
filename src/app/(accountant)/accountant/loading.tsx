// src/app/(accountant)/accountant/loading.tsx
// The outline of the business list while it is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the business list skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AccountantHomeLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the businesses you work on</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <SkeletonTable rows={5} columns={7} />
    </div>
  );
}
