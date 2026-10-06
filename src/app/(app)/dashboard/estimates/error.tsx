// src/app/(app)/dashboard/estimates/error.tsx
// Shown when the estimate list fails to render.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface EstimatesErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the estimate list failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function EstimatesError({ error, reset }: EstimatesErrorProps) {
  useEffect(() => {
    logger.error('The estimate list failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The estimate list could not be loaded"
      message="Your quotations are safe. Something went wrong while reading them for this business."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
