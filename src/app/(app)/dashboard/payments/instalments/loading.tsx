// src/app/(app)/dashboard/payments/instalments/loading.tsx
// The outline of the instalment list while it is being read.

import { SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the instalment list skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function InstalmentsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the instalment arrangements</span>
      <SkeletonTable rows={5} columns={7} />
    </div>
  );
}
