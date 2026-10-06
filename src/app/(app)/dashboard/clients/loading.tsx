// src/app/(app)/dashboard/clients/loading.tsx
// The outline of the client list while it is being read, so the page does not
// jump when the rows arrive.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the client list skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ClientsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your clients</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {['total', 'active', 'inactive', 'archived'].map((key) => (
          <Skeleton key={key} className="h-20 w-full rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-11 w-full max-w-md rounded-lg" />

      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
