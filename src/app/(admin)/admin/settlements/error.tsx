// src/app/(admin)/admin/settlements/error.tsx
// Shown when the settlement console cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminSettlementsErrorProps {
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
export default function AdminSettlementsError({ error, reset }: AdminSettlementsErrorProps) {
  useEffect(() => {
    logger.error('The settlement console failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="The collection terms could not be opened"
      message="No terms have been changed and no payment is affected. Try again, and check the logs if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
