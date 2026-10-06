// src/app/(app)/dashboard/payments/error.tsx
// Shown when the payment list fails to render.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface PaymentsErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the page again. */
  reset: () => void;
}

/**
 * Renders the payment list failure state.
 *
 * @param props The error and the retry function.
 * @returns The rendered state.
 */
export default function PaymentsError({ error, reset }: PaymentsErrorProps) {
  useEffect(() => {
    logger.error('The payment list failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="The payment list could not be loaded"
      message="Your payments are safe. Something went wrong while reading them for this business."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
