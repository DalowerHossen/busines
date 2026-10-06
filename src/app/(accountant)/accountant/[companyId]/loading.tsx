// src/app/(accountant)/accountant/[companyId]/loading.tsx
// The outline of one set of books while it is being read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the books skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function AccountantBooksLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the books of this business</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {['one', 'two', 'three', 'four'].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />
      <SkeletonTable rows={6} columns={5} />
    </div>
  );
}
