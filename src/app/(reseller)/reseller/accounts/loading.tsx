// src/app/(reseller)/reseller/accounts/loading.tsx
// The outline of the partner accounts while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the partner accounts skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function ResellerAccountsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the partner accounts</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {['one', 'two', 'three', 'four'].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
