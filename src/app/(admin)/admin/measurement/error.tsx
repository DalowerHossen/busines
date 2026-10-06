// src/app/(admin)/admin/measurement/error.tsx
// Shown when the measurement console cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface AdminMeasurementErrorProps {
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
export default function AdminMeasurementError({ error, reset }: AdminMeasurementErrorProps) {
  useEffect(() => {
    logger.error('The measurement console failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="The measurement console could not be opened"
      message="Nothing has changed about what this site reports. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
