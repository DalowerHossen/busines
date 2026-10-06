// src/app/(app)/dashboard/messages/error.tsx
// Shown when the outbox cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface MessagesErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the outbox failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function MessagesError({ error, reset }: MessagesErrorProps) {
  useEffect(() => {
    logger.error('The outbox failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The outbox could not be opened"
      message="Nothing has been sent or lost. Try again, and write to support if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
