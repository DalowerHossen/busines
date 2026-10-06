// src/app/(admin)/admin/measurement/loading.tsx
// The outline of the measurement console while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the measurement skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminMeasurementLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading how this website is measured</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
