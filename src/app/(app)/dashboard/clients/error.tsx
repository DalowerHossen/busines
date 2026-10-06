// src/app/(app)/dashboard/clients/error.tsx
// Shown when the client list fails to render. The navigation around it stays
// in place so the page can simply be tried again.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface ClientsErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the client list failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function ClientsError({ error, reset }: ClientsErrorProps) {
  useEffect(() => {
    logger.error('The client list failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The client list could not be loaded"
      message="Your clients are safe. Something went wrong while reading them for this business."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
