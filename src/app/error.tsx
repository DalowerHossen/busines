// src/app/error.tsx
// Shown when a page fails to render. It never prints the technical detail to
// the visitor; it offers a retry and a reference to quote to support.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface ErrorPageProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the failure page for a route segment.
 *
 * @param props The error and the retry function.
 * @returns The rendered page.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    logger.error('A page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center px-4 py-16"
    >
      <ErrorState
        title="This page could not be loaded"
        message="Something went wrong while preparing this page. Trying again usually fixes it."
        reference={error.digest ?? null}
        onRetry={reset}
        className="w-full"
      />
    </main>
  );
}
