// src/app/(admin)/admin/platform/loading.tsx
// The outline of the operations console while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the operations skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminPlatformLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the state of this installation</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
