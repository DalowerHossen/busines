// src/app/(app)/dashboard/products/stock/error.tsx
// Shown when the stock screen cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface StockErrorProps {
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
export default function StockError({ error, reset }: StockErrorProps) {
  useEffect(() => {
    logger.error('The stock screen failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="No quantity has changed and nothing has been revalued. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
