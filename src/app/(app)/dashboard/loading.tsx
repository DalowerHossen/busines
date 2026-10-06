// src/app/(app)/dashboard/loading.tsx
// What the dashboard shows while its figures are being read: the same layout
// in outline, so nothing jumps when the content arrives.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the dashboard placeholder layout.
 *
 * @returns The rendered skeleton.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the dashboard</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['outstanding', 'overdue', 'received', 'clients'].map((key) => (
          <Skeleton key={key} className="h-32 w-full rounded-lg" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  );
}
