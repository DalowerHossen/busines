// src/app/(app)/dashboard/reports/books/loading.tsx
// The outline of the accounting screen while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the accounting skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function BooksLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading the books</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <SkeletonTable rows={6} />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
