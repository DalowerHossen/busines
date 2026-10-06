// src/app/(app)/dashboard/settings/loading.tsx
// The outline of the settings while they are being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the settings skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your settings</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />

      {['one', 'two', 'three'].map((key) => (
        <Skeleton key={key} className="h-64 w-full rounded-lg" />
      ))}
    </div>
  );
}
