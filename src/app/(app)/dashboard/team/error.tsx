// src/app/(app)/dashboard/team/error.tsx
// Shown when the team page cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface TeamErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the team failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function TeamError({ error, reset }: TeamErrorProps) {
  useEffect(() => {
    logger.error('The team page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The team could not be opened"
      message="Nobody has been changed. Try again, and write to support if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
