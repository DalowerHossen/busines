// src/app/(app)/dashboard/billing/loading.tsx
// The outline of the billing page while the plan is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the billing skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function BillingLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your plan</span>

      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {['one', 'two', 'three'].map((key) => (
          <Skeleton key={key} className="h-72 w-full rounded-lg" />
        ))}
      </div>

      <SkeletonTable rows={4} columns={6} />
    </div>
  );
}
