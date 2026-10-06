// src/app/(app)/dashboard/subscriptions/error.tsx
// Shown when the recurring billing list fails to render.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface SubscriptionsErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the recurring billing failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function SubscriptionsError({ error, reset }: SubscriptionsErrorProps) {
  useEffect(() => {
    logger.error('The recurring billing list failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="Recurring billing could not be loaded"
      message="Your schedules are safe and nothing has been billed twice. Something went wrong while reading them."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
