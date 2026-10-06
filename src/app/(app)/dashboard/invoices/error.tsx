// src/app/(app)/dashboard/invoices/error.tsx
// Shown when the invoice list fails to render.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface InvoicesErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the invoice list failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function InvoicesError({ error, reset }: InvoicesErrorProps) {
  useEffect(() => {
    logger.error('The invoice list failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The invoice list could not be loaded"
      message="Your invoices are safe. Something went wrong while reading them for this business."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
