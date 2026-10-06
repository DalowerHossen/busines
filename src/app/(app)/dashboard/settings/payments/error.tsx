// src/app/(app)/dashboard/settings/payments/error.tsx
// Shown when the payment settings cannot be rendered.

'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { logger } from '@/lib/logger';

export interface PaymentSettingsErrorProps {
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
export default function PaymentSettingsError({ error, reset }: PaymentSettingsErrorProps) {
  useEffect(() => {
    logger.error('The payment settings failed to render', error, { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorState
      title="These settings could not be opened"
      message="No connection has been changed. Try again, and write to support if it keeps happening."
      reference={error.digest ?? null}
      onRetry={reset}
    />
  );
}
