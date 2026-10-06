// src/app/(admin)/admin/plans/loading.tsx
// The outline of the catalogue while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the catalogue skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminPlansLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the catalogue</span>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {['a', 'b', 'c'].map((key) => (
          <Skeleton key={key} className="h-60 w-full rounded-lg" />
        ))}
      </div>

      <SkeletonTable rows={4} columns={5} />
    </div>
  );
}
