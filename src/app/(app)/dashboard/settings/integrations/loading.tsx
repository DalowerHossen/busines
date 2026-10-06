// src/app/(app)/dashboard/settings/integrations/loading.tsx
// The outline of the connections page while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the connections skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function IntegrationSettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your connections</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
