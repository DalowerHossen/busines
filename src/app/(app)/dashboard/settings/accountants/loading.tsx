// src/app/(app)/dashboard/settings/accountants/loading.tsx
// The outline of the accountant access page while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the accountant access skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AccountantAccessLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading accountant access</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
