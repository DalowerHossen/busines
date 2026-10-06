// src/app/(marketing)/error.tsx
// Shown when a page in this section fails. The visitor keeps the surrounding
// layout and can retry without losing where they were.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface MarketingErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the failure state for this section.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function MarketingError({ error, reset }: MarketingErrorProps) {
  useEffect(() => {
    logger.error('A page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be loaded"
      message="Nothing is wrong with your account. Something went wrong while preparing this page."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
