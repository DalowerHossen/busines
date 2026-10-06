// src/app/(admin)/admin/platform/error.tsx
// Shown when the operations console cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminPlatformErrorProps {
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
export default function AdminPlatformError({ error, reset }: AdminPlatformErrorProps) {
  useEffect(() => {
    logger.error('The operations console failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="The operations console could not be opened"
      message="Nothing about this installation has changed. Try again, and check the health endpoint if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
