// src/app/d/[token]/error.tsx
// Shown when a client document cannot be rendered at all.

'use client';

import { useEffect } from 'react';

import { logger } from '@/lib/logger';

export interface PortalErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the client facing failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function PortalError({ error, reset }: PortalErrorProps) {
  useEffect(() => {
    logger.error('A client document failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <section className="mx-auto w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center shadow-xs">
      <h1 className="text-xl font-semibold text-foreground">This document could not be opened</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Nothing is wrong with your link. Please try once more, and reply to the email you received
        if it still does not open.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-touch items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </section>
  );
}
