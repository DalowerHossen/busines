// src/app/(admin)/admin/storage/loading.tsx
// The outline of the storage console while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the storage console skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminStorageLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the storage settings</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-72 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
