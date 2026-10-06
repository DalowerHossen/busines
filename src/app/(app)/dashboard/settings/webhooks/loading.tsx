// src/app/(app)/dashboard/settings/webhooks/loading.tsx
// The outline of the webhook screen while it is read.

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

/**
 * Renders the webhook skeleton.
 *
 * @returns The rendered skeleton.
 */
export default function WebhookSettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading where your events are sent</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <SkeletonTable rows={4} />
    </div>
  );
}
