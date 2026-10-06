// src/app/(app)/dashboard/payments/refunds/error.tsx
// Shown when the refund list cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface RefundsErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function RefundsError({ error, reset }: RefundsErrorProps) {
  useEffect(() => {
    logger.error('The refund list failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The refunds could not be opened"
      message="No refund has been changed. Try again, and write to support if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
