// src/app/(admin)/admin/money/loading.tsx
// The outline of the money queue while it is read.

import { SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the queue skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminMoneyLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the money queue</span>
      <SkeletonTable rows={5} columns={6} />
      <SkeletonTable rows={4} columns={4} />
    </div>
  );
}
