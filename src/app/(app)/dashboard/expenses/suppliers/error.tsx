// src/app/(app)/dashboard/expenses/suppliers/error.tsx
// Shown when the supplier screen cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface SuppliersErrorProps {
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
export default function SuppliersError({ error, reset }: SuppliersErrorProps) {
  useEffect(() => {
    logger.error('The supplier screen failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="No bill or payment has been changed. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
