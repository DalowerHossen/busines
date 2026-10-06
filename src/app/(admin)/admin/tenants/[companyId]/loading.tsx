// src/app/(admin)/admin/tenants/[companyId]/loading.tsx
// The outline of one business while it is read.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the detail skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AdminTenantLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the business</span>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  );
}
