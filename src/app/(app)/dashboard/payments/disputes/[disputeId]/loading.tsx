// src/app/(app)/dashboard/payments/disputes/[disputeId]/loading.tsx
// The outline of one dispute while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the dispute skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function DisputeLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading this dispute</span>
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
