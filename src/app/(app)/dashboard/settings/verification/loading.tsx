// src/app/(app)/dashboard/settings/verification/loading.tsx
// The outline of the identity check while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the verification skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function VerificationSettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading your identity check</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />

      {['status', 'answers', 'papers'].map((key) => (
        <Skeleton key={key} className="h-64 w-full rounded-lg" />
      ))}
    </div>
  );
}
