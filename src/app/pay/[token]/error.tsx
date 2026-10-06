// src/app/pay/[token]/error.tsx
// Shown when the payment page cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface CheckoutErrorProps {
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
export default function CheckoutError({ error, reset }: CheckoutErrorProps) {
  useEffect(() => {
    logger.error('The payment page failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="This payment page could not be opened"
      message="No money has been taken. Try again, and reply to the email your invoice came with if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
