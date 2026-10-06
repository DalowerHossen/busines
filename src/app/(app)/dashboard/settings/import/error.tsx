// src/app/(app)/dashboard/settings/import/error.tsx
// Shown when the import screen cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface ImportErrorProps {
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
export default function ImportError({ error, reset }: ImportErrorProps) {
  useEffect(() => {
    logger.error('The import screen failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="Nothing has been imported. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
