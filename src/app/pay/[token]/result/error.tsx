// src/app/pay/[token]/result/error.tsx
// Shown when the result page cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface CheckoutResultErrorProps {
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
export default function CheckoutResultError({ error, reset }: CheckoutResultErrorProps) {
  useEffect(() => {
    logger.error('The payment result page failed to render', error, {
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be opened"
      message="If you have just paid, your payment is safe and the sender will see it. Try again in a moment."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
