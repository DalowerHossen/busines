// src/app/(admin)/admin/tenants/loading.tsx
// The outline of the business list while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the list skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminTenantsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the businesses</span>
      <Skeleton className="h-11 w-full rounded-lg" />
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
