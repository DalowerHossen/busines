// src/app/(app)/dashboard/invoices/collections/error.tsx
// Shown when the collections screen cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface CollectionsErrorProps {
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
export default function CollectionsError({ error, reset }: CollectionsErrorProps) {
  useEffect(() => {
    logger.error('The collections screen failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="No reminder has been sent or changed. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
