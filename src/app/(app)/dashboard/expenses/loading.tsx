// src/app/(app)/dashboard/expenses/loading.tsx
// The outline of the expense list while it is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the expense list skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ExpensesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your expenses</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {['spend', 'awaiting', 'recharge', 'approval'].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-11 w-full max-w-md rounded-lg" />

      <SkeletonTable rows={8} columns={7} />
    </div>
  );
}
