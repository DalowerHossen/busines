// src/app/d/[token]/loading.tsx
// The outline of a client document while it is being opened.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the document skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function PortalLoading() {
  return (
    <div
      className="mx-auto w-full max-w-content space-y-4 rounded-lg border border-border bg-surface p-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="visually-hidden">Opening your document</span>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
