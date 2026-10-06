// src/app/(app)/dashboard/messages/loading.tsx
// The outline of the outbox while it is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the outbox skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function MessagesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your outbox</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {['one', 'two', 'three', 'four'].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      <SkeletonTable rows={5} columns={5} />
    </div>
  );
}
