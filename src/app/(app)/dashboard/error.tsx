// src/app/(app)/dashboard/error.tsx
// Shown when the dashboard itself fails. The frame around it stays, so the
// navigation is still there while the page is retried.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface DashboardErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the dashboard failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    logger.error('The dashboard failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The dashboard could not be loaded"
      message="Your data is safe. Something went wrong while reading the figures for this business."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
