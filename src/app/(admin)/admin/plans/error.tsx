// src/app/(admin)/admin/plans/error.tsx
// Shown when the catalogue cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminPlansErrorProps {
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
export default function AdminPlansError({ error, reset }: AdminPlansErrorProps) {
  useEffect(() => {
    logger.error('The catalogue page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The catalogue could not be opened"
      message="No plan or code has been changed. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
