// src/app/(app)/dashboard/contracts/[contractId]/loading.tsx
// The outline of one agreement while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the agreement skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ContractLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the agreement</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
