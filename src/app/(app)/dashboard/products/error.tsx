// src/app/(app)/dashboard/products/error.tsx
// Shown when the catalogue fails to render. The navigation around it stays in
// place so the page can simply be tried again.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface ProductsErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the catalogue failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function ProductsError({ error, reset }: ProductsErrorProps) {
  useEffect(() => {
    logger.error('The catalogue failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The catalogue could not be loaded"
      message="Your items are safe. Something went wrong while reading them for this business."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
