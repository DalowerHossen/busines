// src/app/(app)/dashboard/expenses/error.tsx
// Shown when the expense list fails to render.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface ExpensesErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the expense list failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function ExpensesError({ error, reset }: ExpensesErrorProps) {
  useEffect(() => {
    logger.error('The expense list failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The expense list could not be loaded"
      message="Your receipts and claims are safe. Something went wrong while reading them for this business."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
