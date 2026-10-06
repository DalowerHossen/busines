// src/app/(app)/dashboard/reports/error.tsx
// Shown when a report fails to render.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface ReportsErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the report failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function ReportsError({ error, reset }: ReportsErrorProps) {
  useEffect(() => {
    logger.error('A report failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The report could not be prepared"
      message="Your figures are safe. Something went wrong while working them out for this period."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
