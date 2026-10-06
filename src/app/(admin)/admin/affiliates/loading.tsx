// src/app/(admin)/admin/affiliates/loading.tsx
// The outline of the referral programme console while it is being read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the referral console skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminAffiliatesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the referral programme</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      {['one', 'two'].map((key) => (
        <Skeleton key={key} className="h-56 w-full rounded-lg" />
      ))}
    </div>
  );
}
