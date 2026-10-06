// src/app/(admin)/admin/experiments/loading.tsx
// The outline of the testing console while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the testing skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminExperimentsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the tests</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
