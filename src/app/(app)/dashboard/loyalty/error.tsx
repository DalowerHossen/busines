// src/app/(app)/dashboard/loyalty/error.tsx
// Shown when the loyalty pages cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface LoyaltyErrorProps {
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
export default function LoyaltyError({ error, reset }: LoyaltyErrorProps) {
  useEffect(() => {
    logger.error('The loyalty pages failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The loyalty pages could not be opened"
      message="No points have moved. Try again, and write to support if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
