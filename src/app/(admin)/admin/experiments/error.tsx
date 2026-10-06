// src/app/(admin)/admin/experiments/error.tsx
// Shown when the testing console cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminExperimentsErrorProps {
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
export default function AdminExperimentsError({ error, reset }: AdminExperimentsErrorProps) {
  useEffect(() => {
    logger.error('The testing console failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="The tests could not be opened"
      message="No test has started, stopped or changed. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
