// src/app/sign/[token]/loading.tsx
// The outline of an agreement while the invitation is being opened.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the signing skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function SigningLoading() {
  return (
    <div
      className="mx-auto w-full max-w-content space-y-4 rounded-lg border border-border bg-surface p-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="visually-hidden">Opening your agreement</span>
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
