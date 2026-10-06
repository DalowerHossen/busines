// src/app/(reseller)/reseller/brand/error.tsx
// Shown when the partner brand cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface ResellerBrandErrorProps {
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
export default function ResellerBrandError({ error, reset }: ResellerBrandErrorProps) {
  useEffect(() => {
    logger.error('The partner brand failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="Nothing has been lost. Try again, and write to support if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
