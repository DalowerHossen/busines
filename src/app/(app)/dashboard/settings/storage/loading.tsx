// src/app/(app)/dashboard/settings/storage/loading.tsx
// The outline of the document storage page while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the document storage skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function StorageSettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your document storage settings</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}
