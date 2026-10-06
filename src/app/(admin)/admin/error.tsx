// src/app/(admin)/admin/error.tsx
// Shown when the platform overview cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminErrorProps {
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
export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    logger.error('The platform console failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="The console could not be opened"
      message="Nothing on the platform has changed. Try again, and check the service status if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
