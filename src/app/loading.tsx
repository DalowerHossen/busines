// src/app/loading.tsx
// Shown while a page is being prepared on the server.

import { LoadingState } from '@/components/ui/loading-state';

/**
 * Renders the waiting state of a route segment.
 *
 * @returns The rendered page.
 */
export default function Loading() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-content px-4 py-10 sm:px-6">
      <LoadingState variant="page" label="Loading the page" />
    </main>
  );
}
