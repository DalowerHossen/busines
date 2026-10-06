// src/app/(admin)/admin/verification/loading.tsx
// The outline of the verification queue while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the verification queue skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminVerificationLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the verification queue</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      {['one', 'two'].map((key) => (
        <Skeleton key={key} className="h-72 w-full rounded-lg" />
      ))}
    </div>
  );
}
