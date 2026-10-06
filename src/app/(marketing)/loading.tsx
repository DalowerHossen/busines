// src/app/(marketing)/loading.tsx
// Placeholder shown while the public pages are being prepared, so a slow network
// shows the shape of the page instead of a blank screen.

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the placeholder layout for this section.
 *
 * @returns The rendered skeleton.
 */
export default function MarketingLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-16"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="visually-hidden">Loading</span>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
